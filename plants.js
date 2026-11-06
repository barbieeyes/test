/* 시드핸즈 — 선택지와 우리 산 식물 도감 */
/* ───── 선택지 ───── */
SH.OPT = {
  comp: ['홑잎', '겹잎'],
  arr: ['어긋나기', '마주나기', '돌려나기·모여나기'],
  shape: ['바늘·선형', '피침형(길쭉)', '달걀·타원형', '심장형', '손바닥형·갈라진 잎'],
  edge: ['밋밋함', '톱니·둥근톱니', '겹톱니·가시톱니'],
  infl: ['하나씩 (단정)', '줄지어 (총상·수상)', '우산살처럼 (산형)', '평평하게 (산방)', '동글게 뭉쳐 (두상)', '가지 갈라지며 (원추·취산)'],
  fruit: ['꼬투리 (협과)', '여러 갈래로 터짐 (삭과)', '한쪽만 갈라짐 (골돌과)', '날개 열매 (시과)', '딱딱한 열매 (견과·수과)', '솔방울 (구과)', '말랑·씨 많음 (장과)', '딱딱한 씨 하나 (핵과)', '사과 모양 (이과)', '작은 열매 모음 (취과·다화과)'],
  bark: ['매끄러움', '세로로 갈라짐', '얇게 벗겨짐', '가시·날개·코르크', '얼룩덜룩 벗겨짐']
};

/* ───── 우리 산 식물 도감 (전국 낮은 산에서 흔한 종, 현장 후보용) ─────
   fm: 열매 익는 달, flm: 꽃 피는 달 */
SH.PLANTS = [
  { n: '신갈나무', s: 'Quercus mongolica', f: '참나무과', t: '나무', comp: '홑잎', arr: '어긋나기', shape: '달걀·타원형', edge: '톱니·둥근톱니', infl: '줄지어 (총상·수상)', flc: '황록색', flm: [5], fruit: '딱딱한 열매 (견과·수과)', fm: [9, 10], bark: '세로로 갈라짐', tip: '잎자루가 거의 없고 잎 가장자리가 물결처럼 굽이쳐요. 도토리 깍정이에 비늘이 오톨도톨!' },
  { n: '갈참나무', s: 'Quercus aliena', f: '참나무과', t: '나무', comp: '홑잎', arr: '어긋나기', shape: '달걀·타원형', edge: '톱니·둥근톱니', infl: '줄지어 (총상·수상)', flc: '황록색', flm: [5], fruit: '딱딱한 열매 (견과·수과)', fm: [9, 10], bark: '세로로 갈라짐', tip: '신갈나무와 닮았지만 잎자루가 1~3cm로 뚜렷해요. 서울·경기 낮은 산에 아주 흔한 참나무예요.' },
  { n: '졸참나무', s: 'Quercus serrata', f: '참나무과', t: '나무', comp: '홑잎', arr: '어긋나기', shape: '달걀·타원형', edge: '톱니·둥근톱니', infl: '줄지어 (총상·수상)', flc: '황록색', flm: [5], fruit: '딱딱한 열매 (견과·수과)', fm: [10], bark: '세로로 갈라짐', tip: '참나무 6형제 중 잎과 도토리가 가장 작아요. 톱니 끝이 안쪽으로 살짝 굽어요.' },
  { n: '상수리나무', s: 'Quercus acutissima', f: '참나무과', t: '나무', comp: '홑잎', arr: '어긋나기', shape: '피침형(길쭉)', edge: '겹톱니·가시톱니', infl: '줄지어 (총상·수상)', flc: '황록색', flm: [5], fruit: '딱딱한 열매 (견과·수과)', fm: [9, 10], bark: '세로로 갈라짐', tip: '잎이 길쭉하고 톱니 끝에 바늘 같은 털이 있어요. 도토리 깍정이가 털복숭이!' },
  { n: '굴참나무', s: 'Quercus variabilis', f: '참나무과', t: '나무', comp: '홑잎', arr: '어긋나기', shape: '피침형(길쭉)', edge: '겹톱니·가시톱니', infl: '줄지어 (총상·수상)', flc: '황록색', flm: [5], fruit: '딱딱한 열매 (견과·수과)', fm: [9, 10], bark: '가시·날개·코르크', tip: '나무껍질이 푹신한 코르크예요. 잎 뒷면에 별모양털이 빽빽해서 하얗게 보여요 → 털 미션 추천!' },
  { n: '밤나무', s: 'Castanea crenata', f: '참나무과', t: '나무', comp: '홑잎', arr: '어긋나기', shape: '피침형(길쭉)', edge: '겹톱니·가시톱니', infl: '줄지어 (총상·수상)', flc: '흰색', flm: [6], fruit: '딱딱한 열매 (견과·수과)', fm: [9, 10], bark: '세로로 갈라짐', tip: '가시 송이 안에 밤(견과)이 들어 있어요. 상수리나무 잎과 비슷하지만 톱니 끝 바늘이 초록색이에요.' },
  { n: '리기다소나무', s: 'Pinus rigida', f: '소나무과', t: '나무', comp: '홑잎', arr: '돌려나기·모여나기', shape: '바늘·선형', edge: '밋밋함', infl: '', flc: '', flm: [5], fruit: '솔방울 (구과)', fm: [9, 10], bark: '세로로 갈라짐', tip: '바늘잎이 3개씩 묶여 나요. 줄기 중간에서도 잎이 삐죽 돋아요. 1960~70년대 산림녹화 때 전국에 많이 심은 소나무예요.' },
  { n: '소나무', s: 'Pinus densiflora', f: '소나무과', t: '나무', comp: '홑잎', arr: '돌려나기·모여나기', shape: '바늘·선형', edge: '밋밋함', infl: '', flc: '', flm: [5], fruit: '솔방울 (구과)', fm: [9, 10], bark: '얇게 벗겨짐', tip: '바늘잎이 2개씩 묶여 나요. 줄기 위쪽 껍질이 붉은빛으로 얇게 벗겨져요.' },
  { n: '일본잎갈나무', s: 'Larix kaempferi', f: '소나무과', t: '나무', comp: '홑잎', arr: '돌려나기·모여나기', shape: '바늘·선형', edge: '밋밋함', infl: '', flc: '', flm: [4, 5], fruit: '솔방울 (구과)', fm: [9, 10], bark: '얇게 벗겨짐', tip: '바늘잎이지만 가을에 노랗게 물들어 떨어지는 신기한 침엽수(낙엽송)예요.' },
  { n: '아까시나무', s: 'Robinia pseudoacacia', f: '콩과', t: '나무', comp: '겹잎', arr: '어긋나기', shape: '달걀·타원형', edge: '밋밋함', infl: '줄지어 (총상·수상)', flc: '흰색', flm: [5], fruit: '꼬투리 (협과)', fm: [9, 10], bark: '세로로 갈라짐', tip: '작은잎 여러 장이 깃털처럼 붙은 겹잎. 잎자루 밑에 가시가 한 쌍 있어요. 5월 꽃향기가 달콤해요.', caution: '가시 조심' },
  { n: '칡', s: 'Pueraria montana var. lobata', f: '콩과', t: '덩굴', comp: '겹잎', arr: '어긋나기', shape: '달걀·타원형', edge: '밋밋함', infl: '줄지어 (총상·수상)', flc: '자주색', flm: [8], fruit: '꼬투리 (협과)', fm: [9, 10], bark: '', tip: '작은잎 3장이 한 세트(3출엽). 꼬투리에 갈색 털이 북슬북슬해요.' },
  { n: '싸리', s: 'Lespedeza bicolor', f: '콩과', t: '나무', comp: '겹잎', arr: '어긋나기', shape: '달걀·타원형', edge: '밋밋함', infl: '줄지어 (총상·수상)', flc: '홍자색', flm: [7, 8], fruit: '꼬투리 (협과)', fm: [10], bark: '', tip: '작은잎 3장 겹잎. 작은 꼬투리 안에 씨가 1개만 들어 있어요.' },
  { n: '팥배나무', s: 'Sorbus alnifolia', f: '장미과', t: '나무', comp: '홑잎', arr: '어긋나기', shape: '달걀·타원형', edge: '겹톱니·가시톱니', infl: '평평하게 (산방)', flc: '흰색', flm: [5], fruit: '사과 모양 (이과)', fm: [9, 10], bark: '매끄러움', tip: '팥알만 한 빨간 열매가 배처럼 생겼다고 팥배! 잎맥이 나란히 뚜렷해요.' },
  { n: '산벚나무', s: 'Prunus sargentii', f: '장미과', t: '나무', comp: '홑잎', arr: '어긋나기', shape: '달걀·타원형', edge: '겹톱니·가시톱니', infl: '우산살처럼 (산형)', flc: '분홍색', flm: [4, 5], fruit: '딱딱한 씨 하나 (핵과)', fm: [6, 7], bark: '매끄러움', tip: '매끈한 껍질에 가로로 긴 숨구멍(껍질눈) 무늬가 있어요.' },
  { n: '조팝나무', s: 'Spiraea prunifolia f. simpliciflora', f: '장미과', t: '나무', comp: '홑잎', arr: '어긋나기', shape: '달걀·타원형', edge: '톱니·둥근톱니', infl: '우산살처럼 (산형)', flc: '흰색', flm: [4], fruit: '한쪽만 갈라짐 (골돌과)', fm: [9], bark: '', tip: '봄에 튀밥 같은 흰 꽃이 줄기 가득. 열매는 한쪽 선으로만 벌어지는 골돌과예요.' },
  { n: '산딸기', s: 'Rubus crataegifolius', f: '장미과', t: '나무', comp: '홑잎', arr: '어긋나기', shape: '손바닥형·갈라진 잎', edge: '겹톱니·가시톱니', infl: '평평하게 (산방)', flc: '흰색', flm: [5, 6], fruit: '작은 열매 모음 (취과·다화과)', fm: [6, 7], bark: '가시·날개·코르크', tip: '작은 알갱이가 모인 열매(취과). 줄기에 가시가 있어요.', caution: '가시 조심' },
  { n: '생강나무', s: 'Lindera obtusiloba', f: '녹나무과', t: '나무', comp: '홑잎', arr: '어긋나기', shape: '손바닥형·갈라진 잎', edge: '밋밋함', infl: '우산살처럼 (산형)', flc: '노란색', flm: [3], fruit: '말랑·씨 많음 (장과)', fm: [9, 10], bark: '매끄러움', tip: '잎이 산(山) 자처럼 3갈래. 가지를 꺾으면 생강 냄새! 겨울엔 동그란 꽃눈과 뾰족한 잎눈을 비교해 보세요.' },
  { n: '진달래', s: 'Rhododendron mucronulatum', f: '진달래과', t: '나무', comp: '홑잎', arr: '어긋나기', shape: '달걀·타원형', edge: '밋밋함', infl: '하나씩 (단정)', flc: '분홍색', flm: [4], fruit: '여러 갈래로 터짐 (삭과)', fm: [10], bark: '매끄러움', tip: '잎보다 꽃이 먼저 펴요. 우리 산의 봄을 대표하는 꽃이에요.' },
  { n: '철쭉', s: 'Rhododendron schlippenbachii', f: '진달래과', t: '나무', comp: '홑잎', arr: '돌려나기·모여나기', shape: '달걀·타원형', edge: '밋밋함', infl: '우산살처럼 (산형)', flc: '연분홍색', flm: [5], fruit: '여러 갈래로 터짐 (삭과)', fm: [10], bark: '매끄러움', tip: '가지 끝에 잎 5장이 빙 둘러 모여 나요. 꽃자루와 열매에 끈적한 샘털이 있어요 → 털 미션 추천!' },
  { n: '때죽나무', s: 'Styrax japonicus', f: '때죽나무과', t: '나무', comp: '홑잎', arr: '어긋나기', shape: '달걀·타원형', edge: '밋밋함', infl: '줄지어 (총상·수상)', flc: '흰색', flm: [5], fruit: '딱딱한 씨 하나 (핵과)', fm: [9], bark: '매끄러움', tip: '흰 꽃과 열매가 아래로 조롱조롱 매달려요. 검고 매끈한 껍질이 특징.' },
  { n: '쪽동백나무', s: 'Styrax obassia', f: '때죽나무과', t: '나무', comp: '홑잎', arr: '어긋나기', shape: '달걀·타원형', edge: '톱니·둥근톱니', infl: '줄지어 (총상·수상)', flc: '흰색', flm: [5, 6], fruit: '딱딱한 씨 하나 (핵과)', fm: [9], bark: '매끄러움', tip: '손바닥보다 큰 둥근 잎. 잎자루 밑동이 겨울눈을 감싸고 있어요.' },
  { n: '서어나무', s: 'Carpinus laxiflora', f: '자작나무과', t: '나무', comp: '홑잎', arr: '어긋나기', shape: '달걀·타원형', edge: '겹톱니·가시톱니', infl: '줄지어 (총상·수상)', flc: '황록색', flm: [4, 5], fruit: '딱딱한 열매 (견과·수과)', fm: [10], bark: '매끄러움', tip: '줄기가 근육처럼 울퉁불퉁하고 매끈한 회색이에요. 작은 견과가 잎 모양 포에 붙어 있어요.' },
  { n: '물박달나무', s: 'Betula davurica', f: '자작나무과', t: '나무', comp: '홑잎', arr: '어긋나기', shape: '달걀·타원형', edge: '겹톱니·가시톱니', infl: '줄지어 (총상·수상)', flc: '황록색', flm: [4, 5], fruit: '딱딱한 열매 (견과·수과)', fm: [9, 10], bark: '얇게 벗겨짐', tip: '껍질이 종이처럼 여러 겹 너덜너덜 벗겨져요. 중부지방 낮은 산에서 자주 만나요.' },
  { n: '당단풍나무', s: 'Acer pseudosieboldianum', f: '무환자나무과', t: '나무', comp: '홑잎', arr: '마주나기', shape: '손바닥형·갈라진 잎', edge: '겹톱니·가시톱니', infl: '평평하게 (산방)', flc: '붉은색', flm: [5], fruit: '날개 열매 (시과)', fm: [9, 10], bark: '매끄러움', tip: '잎이 9~11갈래로 갈라져요. 프로펠러 같은 날개 열매가 빙글빙글 날아가요.' },
  { n: '화살나무', s: 'Euonymus alatus', f: '노박덩굴과', t: '나무', comp: '홑잎', arr: '마주나기', shape: '달걀·타원형', edge: '톱니·둥근톱니', infl: '가지 갈라지며 (원추·취산)', flc: '황록색', flm: [5], fruit: '여러 갈래로 터짐 (삭과)', fm: [10], bark: '가시·날개·코르크', tip: '가지에 화살 깃 같은 코르크 날개가 있어요. 열매가 터지면 주황색 씨가 나와요.' },
  { n: '노박덩굴', s: 'Celastrus orbiculatus', f: '노박덩굴과', t: '덩굴', comp: '홑잎', arr: '어긋나기', shape: '달걀·타원형', edge: '톱니·둥근톱니', infl: '가지 갈라지며 (원추·취산)', flc: '황록색', flm: [5, 6], fruit: '여러 갈래로 터짐 (삭과)', fm: [10, 11], bark: '', tip: '늦가을 노란 열매껍질이 3갈래로 터지면 주황색 씨가 보여요. 지금 채종하기 딱 좋아요!' },
  { n: '청미래덩굴', s: 'Smilax china', f: '청미래덩굴과', t: '덩굴', comp: '홑잎', arr: '어긋나기', shape: '달걀·타원형', edge: '밋밋함', infl: '우산살처럼 (산형)', flc: '황록색', flm: [5], fruit: '말랑·씨 많음 (장과)', fm: [9, 10], bark: '가시·날개·코르크', tip: '동글고 반질반질한 잎, 빨간 열매. 덩굴손과 갈고리 가시로 다른 나무를 붙잡아요.', caution: '가시 조심' },
  { n: '담쟁이덩굴', s: 'Parthenocissus tricuspidata', f: '포도과', t: '덩굴', comp: '홑잎', arr: '어긋나기', shape: '손바닥형·갈라진 잎', edge: '톱니·둥근톱니', infl: '가지 갈라지며 (원추·취산)', flc: '황록색', flm: [6, 7], fruit: '말랑·씨 많음 (장과)', fm: [9, 10], bark: '', tip: '덩굴손 끝의 빨판(흡반)으로 벽이나 바위에 착 붙어요.' },
  { n: '붉나무', s: 'Rhus chinensis', f: '옻나무과', t: '나무', comp: '겹잎', arr: '어긋나기', shape: '달걀·타원형', edge: '톱니·둥근톱니', infl: '가지 갈라지며 (원추·취산)', flc: '흰색', flm: [8, 9], fruit: '딱딱한 씨 하나 (핵과)', fm: [10], bark: '', tip: '겹잎의 잎줄기(잎축)에 날개가 있는 것이 특징. 가을 단풍이 아주 붉어요.', caution: '옻나무와 닮았으니 확실하지 않으면 만지지 마세요' },
  { n: '개옻나무', s: 'Toxicodendron trichocarpum', f: '옻나무과', t: '나무', comp: '겹잎', arr: '어긋나기', shape: '달걀·타원형', edge: '밋밋함', infl: '가지 갈라지며 (원추·취산)', flc: '황록색', flm: [5, 6], fruit: '딱딱한 씨 하나 (핵과)', fm: [9, 10], bark: '', tip: '잎줄기가 붉고 작은잎 여러 장이 깃털처럼 붙어요.', caution: '⚠️ 만지면 피부가 가렵고 부을 수 있어요! 눈으로만 관찰' },
  { n: '산초나무', s: 'Zanthoxylum schinifolium', f: '운향과', t: '나무', comp: '겹잎', arr: '어긋나기', shape: '피침형(길쭉)', edge: '톱니·둥근톱니', infl: '평평하게 (산방)', flc: '연녹색', flm: [8, 9], fruit: '여러 갈래로 터짐 (삭과)', fm: [10], bark: '가시·날개·코르크', tip: '잎을 비비면 톡 쏘는 향! 열매가 갈라지면 까만 씨가 반짝여요.', caution: '가시 조심' },
  { n: '쥐똥나무', s: 'Ligustrum obtusifolium', f: '물푸레나무과', t: '나무', comp: '홑잎', arr: '마주나기', shape: '달걀·타원형', edge: '밋밋함', infl: '줄지어 (총상·수상)', flc: '흰색', flm: [5, 6], fruit: '딱딱한 씨 하나 (핵과)', fm: [10, 11], bark: '매끄러움', tip: '까만 열매가 쥐똥을 닮아 붙은 이름. 산책로 울타리로도 많이 심어요.' },
  { n: '산국', s: 'Chrysanthemum boreale', f: '국화과', t: '풀', comp: '홑잎', arr: '어긋나기', shape: '손바닥형·갈라진 잎', edge: '톱니·둥근톱니', infl: '동글게 뭉쳐 (두상)', flc: '노란색', flm: [9, 10, 11], fruit: '딱딱한 열매 (견과·수과)', fm: [11, 12], bark: '', tip: '작은 노란 국화가 가득. 꽃 한 송이처럼 보이지만 작은 꽃 수십 개가 모인 두상꽃차례예요. 향이 진해요.' },
  { n: '쑥부쟁이', s: 'Aster yomena', f: '국화과', t: '풀', comp: '홑잎', arr: '어긋나기', shape: '피침형(길쭉)', edge: '톱니·둥근톱니', infl: '동글게 뭉쳐 (두상)', flc: '연보라색', flm: [8, 9, 10], fruit: '딱딱한 열매 (견과·수과)', fm: [10, 11], bark: '', tip: '연보라 들국화. 가운데 노란 부분과 바깥 꽃잎 모두 각각 작은 꽃이에요.' },
  { n: '개망초', s: 'Erigeron annuus', f: '국화과', t: '풀', comp: '홑잎', arr: '어긋나기', shape: '달걀·타원형', edge: '톱니·둥근톱니', infl: '동글게 뭉쳐 (두상)', flc: '흰색', flm: [6, 7, 8, 9], fruit: '딱딱한 열매 (견과·수과)', fm: [8, 9, 10], bark: '', tip: '계란 프라이를 닮은 꽃. 줄기와 잎에 털이 많아요.' },
  { n: '서양민들레', s: 'Taraxacum officinale', f: '국화과', t: '풀', comp: '홑잎', arr: '돌려나기·모여나기', shape: '피침형(길쭉)', edge: '겹톱니·가시톱니', infl: '동글게 뭉쳐 (두상)', flc: '노란색', flm: [3, 4, 5, 6, 7, 8, 9], fruit: '딱딱한 열매 (견과·수과)', fm: [4, 5, 6, 7, 8, 9, 10], bark: '', tip: '꽃받침이 뒤로 젖혀져 있으면 서양민들레! 솜털 낙하산(갓털)을 단 수과가 바람에 날아가요.' },
  { n: '애기똥풀', s: 'Chelidonium asiaticum', f: '양귀비과', t: '풀', comp: '홑잎', arr: '어긋나기', shape: '손바닥형·갈라진 잎', edge: '톱니·둥근톱니', infl: '우산살처럼 (산형)', flc: '노란색', flm: [5, 6, 7, 8], fruit: '여러 갈래로 터짐 (삭과)', fm: [7, 8, 9], bark: '', tip: '줄기를 자르면 노란 즙이 나와요. 잎 뒷면이 분을 바른 듯 하얘요.', caution: '노란 즙이 피부를 자극할 수 있어요' },
  { n: '닭의장풀', s: 'Commelina communis', f: '닭의장풀과', t: '풀', comp: '홑잎', arr: '어긋나기', shape: '피침형(길쭉)', edge: '밋밋함', infl: '하나씩 (단정)', flc: '파란색', flm: [7, 8, 9], fruit: '여러 갈래로 터짐 (삭과)', fm: [9, 10], bark: '', tip: '파란 꽃잎 2장이 귀처럼 쫑긋! 잎 밑부분이 줄기를 감싸요.' }
];

SH.findPlant = function (name, sci) {
  if (sci) { const s = SH.PLANTS.find(p => p.s.toLowerCase() === String(sci).toLowerCase()); if (s) return s; }
  if (name) return SH.PLANTS.find(p => p.n === String(name).trim()) || null;
  return null;
};


/* 기탁 양식용 분류 정보 (과명·속국명·저자). 기탁 전 국가표준식물목록과 대조해 주세요. */
SH.TAXO = {
  'Quercus mongolica': ['Fagaceae', '참나무속', 'Fisch. ex Ledeb.'],
  'Quercus aliena': ['Fagaceae', '참나무속', 'Blume'],
  'Quercus serrata': ['Fagaceae', '참나무속', 'Murray'],
  'Quercus acutissima': ['Fagaceae', '참나무속', 'Carruth.'],
  'Quercus variabilis': ['Fagaceae', '참나무속', 'Blume'],
  'Castanea crenata': ['Fagaceae', '밤나무속', 'Siebold & Zucc.'],
  'Pinus rigida': ['Pinaceae', '소나무속', 'Mill.'],
  'Pinus densiflora': ['Pinaceae', '소나무속', 'Siebold & Zucc.'],
  'Larix kaempferi': ['Pinaceae', '잎갈나무속', '(Lamb.) Carrière'],
  'Robinia pseudoacacia': ['Fabaceae', '아까시나무속', 'L.'],
  'Pueraria montana var. lobata': ['Fabaceae', '칡속', '(Willd.) Maesen & S.M.Almeida ex Sanjappa & Predeep'],
  'Lespedeza bicolor': ['Fabaceae', '싸리속', 'Turcz.'],
  'Sorbus alnifolia': ['Rosaceae', '마가목속', '(Siebold & Zucc.) K.Koch'],
  'Prunus sargentii': ['Rosaceae', '벚나무속', 'Rehder'],
  'Spiraea prunifolia f. simpliciflora': ['Rosaceae', '조팝나무속', 'Nakai'],
  'Rubus crataegifolius': ['Rosaceae', '산딸기속', 'Bunge'],
  'Lindera obtusiloba': ['Lauraceae', '생강나무속', 'Blume'],
  'Rhododendron mucronulatum': ['Ericaceae', '진달래속', 'Turcz.'],
  'Rhododendron schlippenbachii': ['Ericaceae', '진달래속', 'Maxim.'],
  'Styrax japonicus': ['Styracaceae', '때죽나무속', 'Siebold & Zucc.'],
  'Styrax obassia': ['Styracaceae', '때죽나무속', 'Siebold & Zucc.'],
  'Carpinus laxiflora': ['Betulaceae', '서어나무속', '(Siebold & Zucc.) Blume'],
  'Betula davurica': ['Betulaceae', '자작나무속', 'Pall.'],
  'Acer pseudosieboldianum': ['Sapindaceae', '단풍나무속', '(Pax) Kom.'],
  'Euonymus alatus': ['Celastraceae', '화살나무속', '(Thunb.) Siebold'],
  'Celastrus orbiculatus': ['Celastraceae', '노박덩굴속', 'Thunb.'],
  'Smilax china': ['Smilacaceae', '청미래덩굴속', 'L.'],
  'Parthenocissus tricuspidata': ['Vitaceae', '담쟁이덩굴속', '(Siebold & Zucc.) Planch.'],
  'Rhus chinensis': ['Anacardiaceae', '붉나무속', 'Mill.'],
  'Toxicodendron trichocarpum': ['Anacardiaceae', '옻나무속', '(Miq.) Kuntze'],
  'Zanthoxylum schinifolium': ['Rutaceae', '초피나무속', 'Siebold & Zucc.'],
  'Ligustrum obtusifolium': ['Oleaceae', '쥐똥나무속', 'Siebold & Zucc.'],
  'Chrysanthemum boreale': ['Asteraceae', '산국속', '(Makino) Makino'],
  'Aster yomena': ['Asteraceae', '참취속', '(Kitam.) Honda'],
  'Erigeron annuus': ['Asteraceae', '개망초속', '(L.) Pers.'],
  'Taraxacum officinale': ['Asteraceae', '민들레속', 'F.H.Wigg.'],
  'Chelidonium asiaticum': ['Papaveraceae', '애기똥풀속', '(H.Hara) Krahulc.'],
  'Commelina communis': ['Commelinaceae', '닭의장풀속', 'L.']
};
/* 학명·과 정보로 기탁 양식 칸 채우기 */
SH.taxoFields = function (sci, familyKo) {
  const t = SH.TAXO[sci] || [];
  return { famLa: t[0] || '', famKo: familyKo || '', genus: sci ? sci.split(' ')[0] : '', genusKo: t[1] || '', author: t[2] || '' };
};
