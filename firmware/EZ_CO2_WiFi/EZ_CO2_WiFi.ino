/*
  EZ-CO2 WiFi  —  EZMAKER nano (ESP32) + CO₂/온습도 센서(Sensirion SCD4x / SCD30)
  ---------------------------------------------------------------------------
  휴대폰 핫스팟(또는 와이파이)에 붙어서 1분 평균을 에코쌤즈 팀 저장소에 바로 올립니다.
  폰에서는 사파리·네이버 등 아무 브라우저로 에코쌤즈 → '공기' 탭을 열면 됩니다.

  - 5초마다 측정 → 1분 평균 → 보드 저장 공간(LittleFS)에 먼저 저장 → 인터넷 되면 올림
    (데이터가 안 터지거나 핫스팟이 꺼져도 보드에 쌓였다가 다시 연결되면 한꺼번에 올라가요)
  - 측정 장소는 에코쌤즈 앱의 공기 탭에서 바꿀 수 있어요 (5분마다 확인)
  - 센서 I2C 핀은 자동으로 찾아요 (시리얼 모니터 115200에서 확인)
  - 추가 라이브러리 필요 없음 (ESP32 보드 패키지만)

  ★ 아이폰 핫스팟: 설정 → 개인용 핫스팟 → '호환성 최대화' 켜기 (보드는 2.4GHz만 잡아요)
  ★ 보드 메뉴 Partition Scheme은 'Default (… SPIFFS)'처럼 저장 공간이 있는 것을 고르세요
*/
#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <LittleFS.h>
#include <time.h>
#include <vector>
#include <algorithm>
#include <Preferences.h>
#include <WebServer.h>
#include <DNSServer.h>

// ==== 설치 페이지에서 입력하면 보드에 저장돼요. 직접 적어도 됩니다 ====
const char* WIFI_SSID_DEFAULT = "";      // 핫스팟(와이파이) 이름, 예: "이정연의 iPhone"
const char* WIFI_PASS_DEFAULT = "";      // 핫스팟 비밀번호
const char* PLACE_DEFAULT = "야외 측정";  // 처음 측정 장소 (앱에서 바꿀 수 있어요)
// ==============================================================
static String wifiSsid, wifiPass;
static Preferences prefs;
#define WIFI_SSID wifiSsid.c_str()
#define WIFI_PASS wifiPass.c_str()
#define FW_VERSION "1.3.5"

// 에코쌤즈 팀 저장소 (앱과 같은 공개 키 · 팀 비밀번호)
const char* SB_URL   = "https://hcvaaxxwqqrbpnloyjzr.supabase.co";
const char* SB_KEY   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjdmFheHh3cXFyYnBubG95anpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjI1MTgsImV4cCI6MjEwMTU5ODUxOH0.8TKT8aExXiyazDY313G9BHTvZCSu2yrTdxlgwxpNCB8";
const char* TEAM_PIN = "2144";

#define FORCE_SDA -1   // 센서 핀을 알면 지정 (예: 21)
#define FORCE_SCL -1   // (예: 22)

// ---------------------------------------------------------------
struct MinRec { uint32_t ep; uint16_t co2; int16_t t; uint16_t h; uint8_t n; } __attribute__((packed));
struct PreRec { uint32_t ms; uint16_t co2; int16_t t; uint16_t h; uint8_t n; };

static String devId, place;
static std::vector<PreRec> pre;            // 시계가 맞춰지기 전 1분 평균 (메모리)
static bool fsOk = false;

// ===== 센서 (SCD4x / SCD30, 핀 자동 탐색) =====
enum SensorType { NONE, SCD4X, SCD30 };
static SensorType sensor = NONE;
static uint8_t addr = 0;
static uint8_t crc8(const uint8_t* d, int n) { uint8_t c = 0xFF; for (int i = 0; i < n; i++) { c ^= d[i]; for (int b = 0; b < 8; b++) c = (c & 0x80) ? (c << 1) ^ 0x31 : (c << 1); } return c; }
static bool cmd(uint16_t c) { Wire.beginTransmission(addr); Wire.write(c >> 8); Wire.write(c & 0xFF); return Wire.endTransmission() == 0; }
static bool cmdArg(uint16_t c, uint16_t a) { uint8_t ab[2] = {(uint8_t)(a >> 8), (uint8_t)(a & 0xFF)}; Wire.beginTransmission(addr); Wire.write(c >> 8); Wire.write(c & 0xFF); Wire.write(ab[0]); Wire.write(ab[1]); Wire.write(crc8(ab, 2)); return Wire.endTransmission() == 0; }
static int i2cDelay = 2;              // 명령 후 기다리는 시간(ms) — 맞는 값을 스스로 찾음
static uint32_t i2cHz = 100000;
static int dbgLeft = 6;               // 처음 몇 번은 받은 바이트를 그대로 보여 줌
static bool readWords(uint16_t* out, int n) {
  int bytes = n * 3;
  int got = Wire.requestFrom((uint8_t)addr, (size_t)bytes, true);
  uint8_t raw[18] = {0}; int k = 0; while (Wire.available() && k < 18) raw[k++] = Wire.read();
  bool ok = (got == bytes && k == bytes);
  for (int i = 0; ok && i < n; i++) { uint8_t* b = raw + i * 3; if (crc8(b, 2) != b[2]) ok = false; else out[i] = (b[0] << 8) | b[1]; }
  if (!ok && dbgLeft > 0) { dbgLeft--;
    String hx; for (int i = 0; i < k; i++) { char t[4]; snprintf(t, sizeof(t), "%02X ", raw[i]); hx += t; }
    Serial.printf("[센서진단] %d바이트 요청 → %d바이트 받음 [%s] 기다림 %dms · %luHz\n", bytes, got, hx.c_str(), i2cDelay, (unsigned long)i2cHz); }
  return ok;
}
static bool probe(uint8_t a) { Wire.beginTransmission(a); return Wire.endTransmission() == 0; }
// 진짜 센서인지 확인: 없는 주소에도 '대답'하면 선이 LOW에 붙은 가짜 → 건너뜀.
// SCD4x면 실제로 준비 상태(3바이트+CRC)를 읽어 봄.
static bool verifyBus() {
  if (probe(0x0F) || probe(0x7E) || probe(0x33)) return false;   // 아무 주소나 대답 = 가짜
  if (sensor == SCD4X) {
    cmd(0x36F6); delay(30); cmd(0x3F86); delay(500);            // 깨우고 측정 멈춤
    uint16_t w[3];   // 측정을 멈춘 상태에서 일련번호(3워드+CRC)를 읽어 봄
    for (int i = 0; i < 3; i++) { if (cmd(0x3682)) { delay(5); if (readWords(w, 3)) return true; } delay(50); }
    return false;
  }
  return true;
}
static bool tryPins(int sda, int scl) {
  if (sda < 0 || scl < 0 || sda == scl) return false;
  Wire.end(); Wire.begin(sda, scl, 100000); delay(20);
  sensor = NONE;
  if (probe(0x62)) { sensor = SCD4X; addr = 0x62; } else if (probe(0x61)) { sensor = SCD30; addr = 0x61; }
  if (sensor == NONE) return false;
  dbgLeft = 0;
  if (!verifyBus()) { Serial.printf("[센서] SDA=%d SCL=%d 는 가짜 대답이라 건너뜀\n", sda, scl); sensor = NONE; return false; }
  dbgLeft = 6;
  Serial.printf("[센서] %s 확인 완료 SDA=%d SCL=%d\n", sensor == SCD4X ? "SCD4x" : "SCD30", sda, scl);
  prefs.putInt("sda", sda); prefs.putInt("scl", scl);
  return true;
}
static bool findSensor() {
  // 지난번에 찾은 핀부터
  int ps = prefs.getInt("sda", -1), pc = prefs.getInt("scl", -1);
  if (tryPins(FORCE_SDA, FORCE_SCL) || tryPins(ps, pc)) return true;
#if defined(CONFIG_IDF_TARGET_ESP32S3)
  const int pins[] = {SDA, SCL, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 38, 39, 40, 41, 42, 47, 48};
#elif defined(CONFIG_IDF_TARGET_ESP32C3)
  const int pins[] = {SDA, SCL, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 21};     // 18·19는 USB라 제외
#else
  const int pins[] = {21, 22, 18, 19, 32, 33, 25, 26, 27, 4, 5, 13, 14, 15, 16, 17, 23, 2, 12};
#endif
  const int n = sizeof(pins) / sizeof(pins[0]);
  for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) {
    if (pins[i] == pins[j]) continue;
    if (tryPins(pins[i], pins[j])) return true;
  }
  Serial.println("[센서] 찾지 못했어요. 케이블이 SENSOR 소켓에 끝까지 꽂혔는지 확인해 주세요.");
  sensor = NONE;
  return false;
}
static void startSensor() {
  if (sensor == SCD4X) {
    cmd(0x36F6); delay(30);            // wake_up (절전 상태였을 때)
    cmd(0x3F86); delay(500);           // stop_periodic_measurement
    cmd(0x3646); delay(30);            // reinit
    bool ok = cmd(0x21B1);             // start_periodic_measurement (5초마다)
    Serial.printf("[센서] 측정 시작 %s\n", ok ? "OK" : "실패");
  }
  else if (sensor == SCD30) { cmdArg(0x4600, 5); delay(20); cmdArg(0x0010, 0); }
}
static uint32_t rdOk = 0, rdNotReady = 0, rdErr = 0; static const char* rdLast = "-";
static bool readSensor(uint16_t& co2, float& t, float& h) {
  uint16_t w[6];
  if (sensor == SCD4X) {
    if (!cmd(0xE4B8)) { rdErr++; rdLast = "명령 실패(0xE4B8)"; return false; } delay(i2cDelay);
    if (!readWords(w, 1)) { rdErr++; rdLast = "준비 상태 읽기 실패"; return false; }
    if ((w[0] & 0x07FF) == 0) { rdNotReady++; rdLast = "아직 측정 전"; return false; }
    if (!cmd(0xEC05)) { rdErr++; rdLast = "명령 실패(0xEC05)"; return false; } delay(i2cDelay);
    if (!readWords(w, 3)) { rdErr++; rdLast = "측정값 읽기 실패"; return false; }
    co2 = w[0]; t = -45.0f + 175.0f * w[1] / 65535.0f; h = 100.0f * w[2] / 65535.0f;
    if (!co2) { rdErr++; rdLast = "CO2 0"; return false; } rdOk++; rdLast = "성공"; return true;
  }
  if (sensor == SCD30) {
    if (!cmd(0x0202)) return false; delay(4);
    if (!readWords(w, 1) || w[0] != 1) return false;
    if (!cmd(0x0300)) return false; delay(4);
    if (!readWords(w, 6)) return false;
    auto f = [](uint16_t hi, uint16_t lo) { uint32_t u = ((uint32_t)hi << 16) | lo; float x; memcpy(&x, &u, 4); return x; };
    co2 = (uint16_t)f(w[0], w[1]); t = f(w[2], w[3]); h = f(w[4], w[5]); return co2 > 0;
  }
  return false;
}

// ===== 시간 =====
static String msStr(uint32_t sec) { char b[24]; snprintf(b, sizeof(b), "%llu", (unsigned long long)sec * 1000ULL); return String(b); }
static bool timeOk() { return time(nullptr) > 1700000000; }
static String fmtLocal(uint32_t ep, const char* f) { time_t tt = ep; struct tm tmv; localtime_r(&tt, &tmv); char b[24]; strftime(b, sizeof(b), f, &tmv); return String(b); }

// ===== 저장 (LittleFS) =====
//  /q/<YYYYMMDDHH>_<장소해시>.bin : 1분 평균 기록 (11바이트씩)
//  /q/<…>.txt                       : 그 시간 묶음의 장소 이름
//  /u/<…>                           : 아직 안 올린 묶음 표시
static String placeHash(const String& s) { uint32_t x = 7; for (size_t i = 0; i < s.length(); i++) x = x * 31 + (uint8_t)s[i]; char b[10]; snprintf(b, sizeof(b), "%07lx", (unsigned long)(x & 0xFFFFFFF)); return String(b); }
static std::vector<MinRec> ramQ;  // 저장 공간을 못 쓸 때 메모리에 보관
static void saveMin(const MinRec& r) {
  if (!fsOk) { if (ramQ.size() < 1440) ramQ.push_back(r); Serial.printf("[기록] CO2 %u ppm (메모리 보관 %u개)\n", r.co2, (unsigned)ramQ.size()); return; }
  String key = fmtLocal(r.ep, "%Y%m%d%H") + "_" + placeHash(place);
  String bin = "/q/" + key + ".bin";
  if (!LittleFS.exists(bin)) { File p = LittleFS.open("/q/" + key + ".txt", "w"); if (p) { p.print(place); p.close(); } }
  File f = LittleFS.open(bin, "a"); if (f) { f.write((const uint8_t*)&r, sizeof(r)); f.close(); }
  File u = LittleFS.open("/u/" + key, "w"); if (u) u.close();
  Serial.printf("[기록] %s CO2 %u ppm  %.1f℃  %.1f%%  (%s)\n", fmtLocal(r.ep, "%H:%M").c_str(), r.co2, r.t / 100.0, r.h / 100.0, place.c_str());
}
static std::vector<String> listDir(const char* dir) {
  std::vector<String> out; File d = LittleFS.open(dir); if (!d) return out;
  for (File f = d.openNextFile(); f; f = d.openNextFile()) { String n = f.name(); int s = n.lastIndexOf('/'); out.push_back(s >= 0 ? n.substring(s + 1) : n); }
  std::sort(out.begin(), out.end()); return out;
}
static void cleanup() {  // 저장 공간 80% 넘으면 이미 올린 오래된 묶음부터 지움
  if (!fsOk) return;
  if (LittleFS.usedBytes() < LittleFS.totalBytes() * 0.8) return;
  for (auto& n : listDir("/q")) {
    if (!n.endsWith(".bin")) continue; String key = n.substring(0, n.length() - 4);
    if (LittleFS.exists("/u/" + key)) continue;
    LittleFS.remove("/q/" + key + ".bin"); LittleFS.remove("/q/" + key + ".txt");
    if (LittleFS.usedBytes() < LittleFS.totalBytes() * 0.6) break;
  }
}

// ===== 팀 저장소 =====
static String jesc(const String& s) { String o; for (size_t i = 0; i < s.length(); i++) { char c = s[i]; if (c == '"' || c == '\\') { o += '\\'; o += c; } else if ((uint8_t)c < 0x20) o += ' '; else o += c; } return o; }
static bool sbRequest(const char* method, const String& path, const String& body, String* resp) {
  WiFiClientSecure cli; cli.setInsecure(); cli.setTimeout(15);
  HTTPClient http; http.setTimeout(15000);
  if (!http.begin(cli, String(SB_URL) + path)) return false;
  http.addHeader("apikey", SB_KEY); http.addHeader("Authorization", String("Bearer ") + SB_KEY); http.addHeader("x-team-pin", TEAM_PIN);
  int code;
  if (strcmp(method, "POST") == 0) { http.addHeader("Content-Type", "application/json"); http.addHeader("Prefer", "resolution=merge-duplicates,return=minimal"); code = http.POST(body); }
  else code = http.GET();
  if (resp && code > 0) *resp = http.getString();
  http.end();
  if (code < 200 || code >= 300) Serial.printf("[저장소] %s 실패 %d\n", method, code);
  return code >= 200 && code < 300;
}
static bool uploadKey(const String& key) {
  File f = LittleFS.open("/q/" + key + ".bin", "r");
  if (!f) { LittleFS.remove("/u/" + key); return true; }
  std::vector<MinRec> recs; MinRec r; while (f.read((uint8_t*)&r, sizeof(r)) == sizeof(r)) recs.push_back(r); f.close();
  if (recs.empty()) { LittleFS.remove("/u/" + key); return true; }
  String pl = PLACE_DEFAULT; File p = LittleFS.open("/q/" + key + ".txt", "r"); if (p) { pl = p.readString(); p.close(); }
  String id = "air_" + devId + "_" + key;
  String day = fmtLocal(recs[0].ep, "%Y-%m-%d");
  String pts; uint32_t last = 0;
  for (auto& x : recs) { uint32_t m = x.ep / 60 * 60; if (m == last) continue; last = m;
    if (pts.length()) pts += ','; pts += "[" + msStr(m) + "," + String(x.co2) + "," + String(x.t / 100.0, 1) + "," + String(x.h / 100.0, 1) + "," + String(x.n) + "]"; }
  String ts = msStr(recs.front().ep / 60 * 60), end = msStr(recs.back().ep / 60 * 60);
  String data = "{\"id\":\"" + id + "\",\"kind\":\"air\",\"src\":\"wifi\",\"dev\":\"" + devId + "\",\"place\":\"" + jesc(pl) + "\",\"day\":\"" + day +
                "\",\"ts\":" + ts + ",\"end\":" + end + ",\"updated\":" + msStr((uint32_t)time(nullptr)) + ",\"points\":[" + pts + "]}";
  String body = "[{\"id\":\"" + id + "\",\"kind\":\"air\",\"author\":null,\"ts\":" + ts + ",\"deleted\":false,\"data\":" + data + "}]";
  bool ok = sbRequest("POST", "/rest/v1/eco_items?on_conflict=id", body, nullptr);
  if (ok) { // 다음 1분 기록이 저장되면 표시가 다시 생겨서 또 올라가요
    LittleFS.remove("/u/" + key);
    Serial.printf("[저장소] %s 올림 (%u분)\n", key.c_str(), (unsigned)recs.size());
  }
  return ok;
}
static bool uploadRam() {  // 메모리에 있는 기록을 시간 묶음별로 올림
  static uint32_t sentEp = 0; static size_t sentN = 0;
  if (ramQ.empty() || (ramQ.back().ep == sentEp && ramQ.size() == sentN)) return true;
  String key0 = fmtLocal(ramQ[0].ep, "%Y%m%d%H"); std::vector<MinRec> grp, rest;
  for (auto& r : ramQ) (fmtLocal(r.ep, "%Y%m%d%H") == key0 ? grp : rest).push_back(r);
  String key = key0 + "_" + placeHash(place), id = "air_" + devId + "_" + key, day = fmtLocal(grp[0].ep, "%Y-%m-%d"), pts; uint32_t last = 0;
  for (auto& x : grp) { uint32_t m = x.ep / 60 * 60; if (m == last) continue; last = m;
    if (pts.length()) pts += ','; pts += "[" + msStr(m) + "," + String(x.co2) + "," + String(x.t / 100.0, 1) + "," + String(x.h / 100.0, 1) + "," + String(x.n) + "]"; }
  String ts = msStr(grp.front().ep / 60 * 60), end = msStr(grp.back().ep / 60 * 60);
  String data = "{\"id\":\"" + id + "\",\"kind\":\"air\",\"src\":\"wifi\",\"dev\":\"" + devId + "\",\"place\":\"" + jesc(place) + "\",\"day\":\"" + day +
                "\",\"ts\":" + ts + ",\"end\":" + end + ",\"updated\":" + msStr((uint32_t)time(nullptr)) + ",\"points\":[" + pts + "]}";
  String body = "[{\"id\":\"" + id + "\",\"kind\":\"air\",\"author\":null,\"ts\":" + ts + ",\"deleted\":false,\"data\":" + data + "}]";
  if (!sbRequest("POST", "/rest/v1/eco_items?on_conflict=id", body, nullptr)) return false;
  Serial.printf("[저장소] %s 올림 (%u분, 메모리)\n", key.c_str(), (unsigned)grp.size());
  // 지난 시간 묶음은 보냈으니 비우고, 지금 시간 묶음은 계속 쌓아서 다시 보냄
  if (key0 != fmtLocal(time(nullptr), "%Y%m%d%H")) { ramQ = rest; sentEp = 0; sentN = 0; return true; }
  sentEp = ramQ.back().ep; sentN = ramQ.size();
  return true;
}
static void uploadPending() {
  if (!fsOk) { uploadRam(); return; }
  int done = 0;
  for (auto& key : listDir("/u")) { if (!uploadKey(key)) break; if (++done >= 4) break; }
}
static void fetchPlace() {  // 앱에서 정한 장소 받아오기
  String resp;
  if (!sbRequest("GET", "/rest/v1/eco_items?select=data&id=eq.air_cfg_" + devId, "", &resp)) return;
  int i = resp.indexOf("\"place\""); if (i < 0) return;
  i = resp.indexOf('"', resp.indexOf(':', i) + 1); if (i < 0) return;
  String v; for (int j = i + 1; j < (int)resp.length(); j++) { char c = resp[j]; if (c == '\\' && j + 1 < (int)resp.length()) { v += resp[++j]; continue; } if (c == '"') break; v += c; }
  v.trim();
  if (v.length() && v != place) {
    place = v; File f = LittleFS.open("/place.txt", "w"); if (f) { f.print(place); f.close(); } prefs.putString("place", place);
    Serial.printf("[장소] 앱에서 바꾼 장소: %s\n", place.c_str());
  }
}

// ===== 1분 평균 =====
static uint32_t winStart = 0, winN = 0; static double sc = 0, st = 0, sh = 0;
static void closeWindow() {
  if (!winN) return;
  uint16_t co2 = (uint16_t)lround(sc / winN); int16_t t = (int16_t)lround(st / winN * 100); uint16_t h = (uint16_t)lround(sh / winN * 100); uint8_t n = winN > 255 ? 255 : winN;
  if (timeOk()) { MinRec r = {(uint32_t)time(nullptr), co2, t, h, n}; saveMin(r); }
  else { if (pre.size() < 600) pre.push_back({millis(), co2, t, h, n}); Serial.printf("[기록] 시계 맞추기 전이라 메모리에 보관 (%u개)\n", (unsigned)pre.size()); }
  winN = 0; sc = st = sh = 0;
}
static void flushPre() {  // 시계가 맞춰지면 메모리에 있던 기록을 실제 시각으로 바꿔 저장
  if (pre.empty() || !timeOk()) return;
  uint32_t now = time(nullptr), ms = millis();
  for (auto& p : pre) { MinRec r = {now - (ms - p.ms) / 1000, p.co2, p.t, p.h, p.n}; saveMin(r); }
  pre.clear();
}

// ===== 휴대폰으로 설정하기: 보드가 'EZ-CO2-설정-xxxx' 와이파이를 엶 =====
static WebServer web(80);
static DNSServer dns;
static bool apOn = false;
static uint32_t apSince = 0, staLostSince = 0;
static uint16_t lastCo2 = 0; static float lastT = 0, lastH = 0;
static String apName() { String d = devId; d.toUpperCase(); return "EZ-CO2-SETUP-" + d.substring(2); }
static String hesc(const String& s) { String o; for (size_t i = 0; i < s.length(); i++) { char c = s[i]; if (c == '<') o += "&lt;"; else if (c == '>') o += "&gt;"; else if (c == '"') o += "&quot;"; else if (c == '&') o += "&amp;"; else o += c; } return o; }
static void sendPage(const String& msg) {
  bool on = WiFi.status() == WL_CONNECTED; String d = devId; d.toUpperCase();
  String h = F("<!doctype html><html lang=ko><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>공기 보드 설정</title><style>"
    "body{margin:0;font:17px/1.6 -apple-system,system-ui,sans-serif;background:#F6FAF2;color:#1D3B2A}"
    "header{background:#2FA463;color:#fff;padding:18px;text-align:center;border-bottom:4px solid #C6DE3A}h1{margin:0;font-size:24px}"
    "main{max-width:480px;margin:0 auto;padding:16px}.c{background:#fff;border:1.5px solid #dde6dc;border-radius:18px;padding:16px;margin-bottom:14px}"
    "label{display:block;font-size:13px;font-weight:700;color:#1E7F4A;margin:12px 0 4px}input{width:100%;box-sizing:border-box;font-size:17px;padding:12px;border:2px solid #cfd9d2;border-radius:12px}"
    "button{width:100%;margin-top:16px;padding:14px;font-size:19px;font-weight:700;border-radius:14px;border:2.5px solid #1E7F4A;background:#FFEB3B;color:#1D3B2A}"
    ".s{display:flex;gap:8px;flex-wrap:wrap}.s span{flex:1;min-width:90px;text-align:center;padding:8px;border-radius:12px;background:#F3F8EC;font-weight:700;font-size:14px}.ok{background:#2FA463!important;color:#fff}"
    ".m{padding:12px;border-radius:12px;background:#FFF8DB;border:1.5px solid #F2D45A;margin-bottom:14px}small{color:#5F7A68}</style></head><body><header><h1>에코쌤즈 공기 보드</h1><small style='color:#fff'>보드 ");
  h += d + "</small></header><main>";
  if (msg.length()) h += "<div class=m>" + msg + "</div>";
  h += "<div class=c><div class=s><span class='" + String(sensor != NONE ? "ok" : "") + "'>센서 " + (sensor != NONE ? "✓" : "✕") + "</span><span class='" + String(on ? "ok" : "") + "'>와이파이 " + (on ? "✓" : "✕") + "</span></div>";
  if (lastCo2) h += "<p style='text-align:center;margin:12px 0 0'>지금 CO₂ <b>" + String(lastCo2) + "</b> ppm · " + String(lastT, 1) + "℃ · " + String(lastH, 0) + "%</p>";
  h += "</div><form class=c method=post action=/save><b>핫스팟(와이파이) 정보</b><br><small>아이폰: 설정 → 개인용 핫스팟 → '호환성 최대화' 켜기</small>"
       "<label>핫스팟 이름</label><input name=s maxlength=32 required value=\"" + hesc(wifiSsid) + "\" placeholder='예: 이정연의 iPhone'>"
       "<label>비밀번호</label><input name=p type=password maxlength=63 placeholder='" + String(wifiPass.length() ? "(바꾸지 않으려면 비워 두세요)" : "") + "'>"
       "<label>측정 장소</label><input name=l maxlength=30 value=\"" + hesc(place) + "\">"
       "<button>저장하고 다시 시작</button></form><p><small>저장하면 보드가 다시 시작해서 핫스팟에 연결해요. 이 설정 와이파이는 핫스팟에 연결되고 몇 분 뒤 꺼져요.</small></p></main></body></html>";
  web.send(200, "text/html; charset=utf-8", h);
}
static void startAP() {
  if (apOn) return;
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(apName().c_str());
  delay(100);
  dns.start(53, "*", WiFi.softAPIP());
  web.on("/", HTTP_GET, []() { sendPage(""); });
  web.on("/save", HTTP_POST, []() {
    String ss = web.arg("s"), pw = web.arg("p"), pl = web.arg("l"); ss.trim(); pl.trim();
    if (!ss.length()) { sendPage("핫스팟 이름을 적어 주세요."); return; }
    prefs.putString("ssid", ss); if (pw.length()) prefs.putString("pass", pw);
    if (pl.length()) { prefs.putString("place", pl); if (fsOk) { File f = LittleFS.open("/place.txt", "w"); if (f) { f.print(pl); f.close(); } } }
    sendPage("저장했어요! 보드가 다시 시작해요. 이제 휴대폰 핫스팟을 켜 두세요.");
    delay(1500); ESP.restart();
  });
  web.onNotFound([]() { web.sendHeader("Location", "http://" + WiFi.softAPIP().toString() + "/", true); web.send(302, "text/plain", ""); });
  web.begin();
  apOn = true; apSince = millis();
  Serial.printf("[설정] 휴대폰 와이파이에서 '%s'에 연결하면 설정 화면이 떠요\n", apName().c_str());
}
static void stopAP() {
  if (!apOn) return;
  web.stop(); dns.stop(); WiFi.softAPdisconnect(true); WiFi.mode(WIFI_STA);
  apOn = false; Serial.println("[설정] 설정 와이파이를 껐어요");
}

// 설치 페이지(웹 시리얼)에서 보내는 명령
//   INFO                       → 보드 정보
//   SET<tab>이름<tab>비밀번호<tab>장소   → 저장 후 다시 시작
static void serialCmd() {
  static String line;
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\r') continue;
    if (c != '\n') { if (line.length() < 300) line += c; continue; }
    String l = line; line = "";
    if (l == "INFO") { Serial.printf("EZCO2 INFO dev=%s ver=%s ssid=%s place=%s wifi=%d sensor=%d time=%d\n", devId.c_str(), FW_VERSION, wifiSsid.c_str(), place.c_str(), WiFi.status() == WL_CONNECTED, sensor != NONE, timeOk()); }
    else if (l.startsWith("SET\t")) {
      int a = l.indexOf('\t', 4), b = a < 0 ? -1 : l.indexOf('\t', a + 1);
      if (a < 0) { Serial.println("EZCO2 ERR"); continue; }
      String ss = l.substring(4, a), pw = b < 0 ? l.substring(a + 1) : l.substring(a + 1, b), pl = b < 0 ? "" : l.substring(b + 1);
      prefs.putString("ssid", ss); prefs.putString("pass", pw);
      if (pl.length()) { prefs.putString("place", pl); if (fsOk) { File f = LittleFS.open("/place.txt", "w"); if (f) { f.print(pl); f.close(); } } }
      Serial.println("EZCO2 OK 저장했어요. 다시 시작합니다."); Serial.flush(); delay(300); ESP.restart();
    }
  }
}

void setup() {
  Serial.begin(115200); { uint32_t t0 = millis(); while (!Serial && millis() - t0 < 2000) delay(10); } delay(200);
  prefs.begin("ezco2", false);
  wifiSsid = prefs.getString("ssid", WIFI_SSID_DEFAULT); wifiPass = prefs.getString("pass", WIFI_PASS_DEFAULT);
  Serial.println("\n=== EZ-CO2 WiFi ===");
  uint64_t mac = ESP.getEfuseMac(); char b[8]; snprintf(b, sizeof(b), "%02x%02x%02x", (unsigned)((mac >> 24) & 0xFF), (unsigned)((mac >> 32) & 0xFF), (unsigned)((mac >> 40) & 0xFF)); devId = b;
  Serial.printf("[보드] 이름: 보드 %s\n", devId.c_str());
  fsOk = LittleFS.begin(false);
  if (!fsOk) { Serial.println("[저장] 저장 공간을 새로 만드는 중… (처음 한 번, 10초쯤)"); LittleFS.end(); if (LittleFS.format()) fsOk = LittleFS.begin(false); }
  if (fsOk) { LittleFS.mkdir("/q"); LittleFS.mkdir("/u"); File f = LittleFS.open("/place.txt", "r"); if (f) { place = f.readString(); f.close(); place.trim(); } }
  else Serial.println("[저장] 저장 공간을 열지 못했어요 (Partition Scheme 확인). 인터넷이 될 때만 기록돼요.");
  if (!place.length()) place = prefs.getString("place", PLACE_DEFAULT);
  Serial.printf("[장소] %s\n", place.c_str());
  if (findSensor()) startSensor();
  WiFi.mode(WIFI_STA); WiFi.setAutoReconnect(true);
  if (strlen(WIFI_SSID)) WiFi.begin(WIFI_SSID, WIFI_PASS); else { Serial.println("[와이파이] 핫스팟 정보가 아직 없어요."); startAP(); }
  configTzTime("KST-9", "pool.ntp.org", "time.google.com", "time.cloudflare.com");
}

void loop() {
  static uint32_t lastPoll = 0, lastUp = 0, lastCfg = 0, lastRetry = 0, lastWifi = 0; static bool wasOn = false;
  uint32_t now = millis();
  serialCmd();

  // 와이파이 상태
  bool on = WiFi.status() == WL_CONNECTED;
  if (on != wasOn) { wasOn = on; Serial.println(on ? "[와이파이] 연결됨" : "[와이파이] 끊김 · 기록은 보드에 쌓여요"); if (on) { lastUp = 0; lastCfg = 0; } }
  if (apOn) { dns.processNextRequest(); web.handleClient(); }
  if (on) staLostSince = 0; else if (!staLostSince) staLostSince = now;
  // 핫스팟에 1분 넘게 못 붙으면 설정 와이파이를 켬 / 연결되고 5분 지나면(설정 중인 사람 없으면) 끔
  if (!apOn && (!strlen(WIFI_SSID) || (staLostSince && now - staLostSince > 60000))) startAP();
  if (apOn && on && now - apSince > 300000 && WiFi.softAPgetStationNum() == 0) stopAP();
  bool someoneSetting = apOn && WiFi.softAPgetStationNum() > 0;
  if (!on && !someoneSetting && strlen(WIFI_SSID) && now - lastWifi > 30000) { lastWifi = now; WiFi.disconnect(); WiFi.begin(WIFI_SSID, WIFI_PASS); }

  // 센서
  if (sensor == NONE) { if (now - lastRetry > 10000) { lastRetry = now; if (findSensor()) startSensor(); } }
  else if (now - lastPoll >= 1000) {
    lastPoll = now; uint16_t co2; float t, h;
    if (readSensor(co2, t, h)) { if (!winN) winStart = now; winN++; sc += co2; st += t; sh += h; lastCo2 = co2; lastT = t; lastH = h; }
  }
  if (winN && now - winStart >= 60000) closeWindow();
  static uint32_t lastStat = 0, lastGood = 0, lastOkN = 0, restarts = 0;
  if (rdOk != lastOkN) { lastOkN = rdOk; lastGood = now; }
  if (sensor != NONE && now - lastGood > 20000 && now > 20000) {
    lastGood = now; restarts++;
    Serial.printf("[센서] 20초 동안 값이 없어 센서를 다시 시작해요 (%u번째, 마지막: %s)\n", (unsigned)restarts, rdLast);
    static const int delays[] = {2, 5, 20, 2, 5, 20, 2, 5, 20};
    static const uint32_t hzs[] = {100000, 100000, 100000, 50000, 50000, 50000, 20000, 20000, 20000};
    int idx = restarts % 9; i2cDelay = delays[idx]; i2cHz = hzs[idx]; Wire.setClock(i2cHz); dbgLeft = 2;
    Serial.printf("[센서] 다른 방식으로 시도: 기다림 %dms · 속도 %luHz\n", i2cDelay, (unsigned long)i2cHz);
    startSensor();
  }
  if (now - lastStat > 15000) { lastStat = now;
    Serial.printf("[상태] 센서 성공 %u · 측정 전 %u · 오류 %u (마지막: %s) · 지금 CO2 %u · 와이파이 %s · 시계 %s · 저장공간 %s\n",
      (unsigned)rdOk, (unsigned)rdNotReady, (unsigned)rdErr, rdLast, lastCo2, WiFi.status() == WL_CONNECTED ? "연결" : "끊김", timeOk() ? "맞음" : "아직", fsOk ? "OK" : "메모리"); }
  flushPre();

  // 올리기 · 장소 확인
  if (on && timeOk()) {
    if (now - lastUp > 20000 || lastUp == 0) { lastUp = now; uploadPending(); cleanup(); }
    if (now - lastCfg > 300000 || lastCfg == 0) { lastCfg = now; fetchPlace(); }
  }
  delay(20);
}
