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

// ==== 설치 페이지에서 입력하면 보드에 저장돼요. 직접 적어도 됩니다 ====
const char* WIFI_SSID_DEFAULT = "";      // 핫스팟(와이파이) 이름, 예: "이정연의 iPhone"
const char* WIFI_PASS_DEFAULT = "";      // 핫스팟 비밀번호
const char* PLACE_DEFAULT = "야외 측정";  // 처음 측정 장소 (앱에서 바꿀 수 있어요)
// ==============================================================
static String wifiSsid, wifiPass;
static Preferences prefs;
#define WIFI_SSID wifiSsid.c_str()
#define WIFI_PASS wifiPass.c_str()
#define FW_VERSION "1.1"

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
static bool readWords(uint16_t* out, int n) {
  int bytes = n * 3; if (Wire.requestFrom((int)addr, bytes) != bytes) return false;
  for (int i = 0; i < n; i++) { uint8_t b[3] = {(uint8_t)Wire.read(), (uint8_t)Wire.read(), (uint8_t)Wire.read()}; if (crc8(b, 2) != b[2]) return false; out[i] = (b[0] << 8) | b[1]; }
  return true;
}
static bool probe(uint8_t a) { Wire.beginTransmission(a); return Wire.endTransmission() == 0; }
static bool findSensor() {
#if defined(CONFIG_IDF_TARGET_ESP32S3)
  const int pairs[][2] = {{FORCE_SDA, FORCE_SCL}, {SDA, SCL}, {8, 9}, {9, 8}, {1, 2}, {2, 1}, {4, 5}, {5, 4}, {6, 7}, {7, 6}, {11, 12}, {12, 11}, {17, 18}, {18, 17}, {38, 39}, {39, 38}, {41, 42}, {42, 41}};
#elif defined(CONFIG_IDF_TARGET_ESP32C3)
  const int pairs[][2] = {{FORCE_SDA, FORCE_SCL}, {SDA, SCL}, {8, 9}, {9, 8}, {4, 5}, {5, 4}, {6, 7}, {7, 6}, {0, 1}, {1, 0}, {2, 3}, {3, 2}, {10, 3}};
#else
  const int pairs[][2] = {{FORCE_SDA, FORCE_SCL}, {21, 22}, {22, 21}, {18, 19}, {19, 18}, {32, 33}, {33, 32}, {25, 26}, {26, 25}, {26, 27}, {27, 26}, {4, 5}, {5, 4}, {13, 14}, {14, 13}, {23, 22}, {4, 15}, {15, 4}, {2, 4}, {12, 13}};
#endif
  for (auto& p : pairs) {
    if (p[0] < 0) continue;
    Wire.end(); Wire.begin(p[0], p[1], 50000); delay(20);
    if (probe(0x62)) { sensor = SCD4X; addr = 0x62; } else if (probe(0x61)) { sensor = SCD30; addr = 0x61; }
    if (sensor != NONE) { Serial.printf("[센서] %s 발견 SDA=%d SCL=%d\n", sensor == SCD4X ? "SCD4x" : "SCD30", p[0], p[1]); return true; }
  }
  Serial.println("[센서] 찾지 못했어요. 케이블을 확인하거나 FORCE_SDA/SCL을 지정해 보세요.");
  return false;
}
static void startSensor() {
  if (sensor == SCD4X) { cmd(0x3F86); delay(500); cmd(0x21B1); }
  else if (sensor == SCD30) { cmdArg(0x4600, 5); delay(20); cmdArg(0x0010, 0); }
}
static bool readSensor(uint16_t& co2, float& t, float& h) {
  uint16_t w[6];
  if (sensor == SCD4X) {
    if (!cmd(0xE4B8)) return false; delay(2);
    if (!readWords(w, 1) || (w[0] & 0x07FF) == 0) return false;
    if (!cmd(0xEC05)) return false; delay(2);
    if (!readWords(w, 3)) return false;
    co2 = w[0]; t = -45.0f + 175.0f * w[1] / 65535.0f; h = 100.0f * w[2] / 65535.0f; return co2 > 0;
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
static void saveMin(const MinRec& r) {
  if (!fsOk) return;
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
static void uploadPending() {
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
  Serial.begin(115200); delay(300);
  prefs.begin("ezco2", false);
  wifiSsid = prefs.getString("ssid", WIFI_SSID_DEFAULT); wifiPass = prefs.getString("pass", WIFI_PASS_DEFAULT);
  Serial.println("\n=== EZ-CO2 WiFi ===");
  uint64_t mac = ESP.getEfuseMac(); char b[8]; snprintf(b, sizeof(b), "%02x%02x%02x", (unsigned)((mac >> 24) & 0xFF), (unsigned)((mac >> 32) & 0xFF), (unsigned)((mac >> 40) & 0xFF)); devId = b;
  Serial.printf("[보드] 이름: 보드 %s\n", devId.c_str());
  fsOk = LittleFS.begin(true);
  if (fsOk) { LittleFS.mkdir("/q"); LittleFS.mkdir("/u"); File f = LittleFS.open("/place.txt", "r"); if (f) { place = f.readString(); f.close(); place.trim(); } }
  else Serial.println("[저장] 저장 공간을 열지 못했어요 (Partition Scheme 확인). 인터넷이 될 때만 기록돼요.");
  if (!place.length()) place = prefs.getString("place", PLACE_DEFAULT);
  Serial.printf("[장소] %s\n", place.c_str());
  if (findSensor()) startSensor();
  WiFi.mode(WIFI_STA); WiFi.setAutoReconnect(true);
  if (strlen(WIFI_SSID)) WiFi.begin(WIFI_SSID, WIFI_PASS); else Serial.println("[와이파이] 핫스팟 이름이 아직 없어요. 설치 페이지에서 입력해 주세요.");
  configTzTime("KST-9", "pool.ntp.org", "time.google.com", "time.cloudflare.com");
}

void loop() {
  static uint32_t lastPoll = 0, lastUp = 0, lastCfg = 0, lastRetry = 0, lastWifi = 0; static bool wasOn = false;
  uint32_t now = millis();
  serialCmd();

  // 와이파이 상태
  bool on = WiFi.status() == WL_CONNECTED;
  if (on != wasOn) { wasOn = on; Serial.println(on ? "[와이파이] 연결됨" : "[와이파이] 끊김 · 기록은 보드에 쌓여요"); if (on) { lastUp = 0; lastCfg = 0; } }
  if (!on && strlen(WIFI_SSID) && now - lastWifi > 30000) { lastWifi = now; WiFi.disconnect(); WiFi.begin(WIFI_SSID, WIFI_PASS); }

  // 센서
  if (sensor == NONE) { if (now - lastRetry > 10000) { lastRetry = now; if (findSensor()) startSensor(); } }
  else if (now - lastPoll >= 1000) {
    lastPoll = now; uint16_t co2; float t, h;
    if (readSensor(co2, t, h)) { if (!winN) winStart = now; winN++; sc += co2; st += t; sh += h; }
  }
  if (winN && now - winStart >= 60000) closeWindow();
  flushPre();

  // 올리기 · 장소 확인
  if (on && timeOk()) {
    if (now - lastUp > 20000 || lastUp == 0) { lastUp = now; uploadPending(); cleanup(); }
    if (now - lastCfg > 300000 || lastCfg == 0) { lastCfg = now; fetchPlace(); }
  }
  delay(20);
}
