// Evidence checklist (साक्ष्य सूची) data for each SQAAF framework parameter.
// Transcribed from the same source used to build realFrameworkData.ts:
// State Council of Educational Research & Training (SCERT), Uttar Pradesh,
// "SQAAF Checklist" (8 June 2026 version).
// Hindi text (itemsHi) is copied verbatim from the source, with only the leading
// list numbering ("1.", "2.", etc.) stripped. English text (itemsEn) is a faithful
// literal translation produced for this seed file and is not itself an official
// government translation.

export type EvidenceChecklistSeed = {
  code: string; // matches ParameterSeed.code in realFrameworkData.ts exactly
  itemsHi: string[]; // each numbered evidence item's Hindi text, verbatim from the source
  itemsEn: string[]; // faithful literal English translation of each item, same order/length
};

export const REAL_FRAMEWORK_EVIDENCE_DATA: EvidenceChecklistSeed[] = [
  {
    code: '1.1.1',
    itemsHi: [
      'प्रत्येक कक्षा कक्ष की फोटो जिसमें उसके उपयोग की पुष्टि होती है।',
      'विद्यार्थी उपस्थिति पंजिका की फोटो जिसमें सेक्शन व विद्यार्थी संख्या स्पष्ट हो।',
      'यू-डाइस प्लस (UDISE+) प्रविष्टि, जो यह पुष्टि करे कि कोई भी कक्षा कक्ष साझा या बहुउद्देश्यीय (मल्टीपरपज़) उपयोग के रूप में दर्ज नहीं है।',
    ],
    itemsEn: [
      'Photo of each classroom confirming its use.',
      'Photo of the student attendance register clearly showing the section and student count.',
      'UDISE+ entry confirming that no classroom is recorded as shared or multipurpose use.',
    ],
  },
  {
    code: '1.1.2',
    itemsHi: [
      'कक्षा की फोटो, जिसमें सभी बच्चे व शिक्षक दिखें।',
      'ऐसा फोटो जिसमें बेंचों के बीच पर्याप्त जगह दिखे और शिक्षक आसानी से चल सकें।',
      'कक्षा की फोटो जिसमें फर्नीचर को समूह/घेरा बनाकर रखा जा सके और गतिविधियों के लिए खुली जगह दिखे।',
      'यू-डाइस प्लस (UDISE+) प्रविष्टि, जो कक्षा के अनुसार नामांकन और कक्षा के आकार के अनुसार बच्चों की संख्या की पुष्टि करे।',
    ],
    itemsEn: [
      'Photo of the classroom showing all children and the teacher.',
      'A photo showing adequate space between benches, allowing the teacher to move easily.',
      'Photo of the classroom showing furniture arranged in groups/circles with open space for activities.',
      'UDISE+ entry confirming class-wise enrollment and the number of children according to classroom size.',
    ],
  },
  {
    code: '1.1.3',
    itemsHi: [
      'प्रत्येक कक्षा का फोटो जिसमें खुली खिड़कियाँ और चल रहे पंखे/एसी स्पष्ट दिखें।',
    ],
    itemsEn: [
      'Photo of each classroom clearly showing open windows and running fans/AC.',
    ],
  },
  {
    code: '1.1.4',
    itemsHi: [
      'प्राकृतिक रोशनी से युक्त कक्षा कक्ष का फोटो।',
      'प्रत्येक कक्षा का फोटो जिसमें एलईडी बल्ब जल रहे हों और रोशनी का स्तर स्पष्ट दिखे।',
    ],
    itemsEn: [
      'Photo of a classroom with natural light.',
      'Photo of each classroom showing LED bulbs lit and the light level clearly visible.',
    ],
  },
  {
    code: '1.1.5',
    itemsHi: [
      'उपलब्ध कक्षों (प्रधानाध्यापक कक्ष, स्टाफ कक्ष, स्टोर/भंडार कक्ष) के पृथक-पृथक फोटो, जिनमें उनका वास्तविक उपयोग स्पष्ट दिखे।',
    ],
    itemsEn: [
      'Separate photos of the available rooms (head-teacher room, staff room, store/storage room), clearly showing their actual use.',
    ],
  },
  {
    code: '1.1.6',
    itemsHi: [
      'पेय जल के क्रियाशील स्रोत/नल/फिल्टर की फोटो, जिसमें उसका स्थान और आसपास का क्षेत्र भी दिखे।',
      'जल गुणवत्ता जाँच आख्या (तिथि, जाँच एजेंसी, परिणाम सहित)।',
      'यू-डाइस प्लस (UDISE+) प्रविष्टि, जो पेयजल की उपलब्धता, स्रोत प्रकार और फिल्टर की स्थिति की पुष्टि करे।',
    ],
    itemsEn: [
      'Photo of the functional drinking water source/tap/filter, showing its location and the surrounding area.',
      'Water quality test report (including date, testing agency, and results).',
      'UDISE+ entry confirming the availability of drinking water, source type, and filter status.',
    ],
  },
  {
    code: '1.1.7',
    itemsHi: [
      'प्रत्येक शौचालय ब्लॉक के बाहरी और भीतरी भाग के फोटो, जिसमें उसकी समग्र स्थिति दिखे।',
      'दिव्यांग अनुकूल (CWSN) शौचालय का फोटो।',
      'सफाई रजिस्टर/लॉगबुक की प्रति, जिसमें पिछले 30 दिनों की दैनिक सफाई प्रविष्टियाँ और जिम्मेदार व्यक्ति के हस्ताक्षर हों।',
      'यू-डाइस प्लस (UDISE+) प्रविष्टि, जो शौचालयों की संख्या और स्थिति की पुष्टि करे।',
    ],
    itemsEn: [
      'Photos of the outside and inside of each toilet block, showing its overall condition.',
      'Photo of the disability-friendly (CWSN) toilet.',
      'Copy of the cleaning register/logbook, showing daily cleaning entries for the last 30 days and the signature of the responsible person.',
      'UDISE+ entry confirming the number and condition of toilets.',
    ],
  },
  {
    code: '1.1.8',
    itemsHi: [
      'प्रत्येक कार्यरत हैंडवॉश यूनिट की फोटो, जिसमें चल रहा नल, साबुन, साफ़ सतह और सही जल निकास (ड्रेनेज) दिखे।',
      'यू-डाइस प्लस (UDISE+) प्रविष्टि, जो विद्यालय में हैंडवॉश सुविधा की उपलब्धता/स्थिति की पुष्टि करे।',
    ],
    itemsEn: [
      'Photo of each functioning handwash unit, showing running tap, soap, a clean surface, and proper drainage.',
      'UDISE+ entry confirming the availability/status of the handwash facility in the school.',
    ],
  },
  {
    code: '1.1.9',
    itemsHi: [
      'ऐसा फोटो जिसमें खेल के कोर्ट/लाइन मार्किंग, खेलते बच्चे दिखाई दें।',
      'खेल सामग्री, स्टॉक रजिस्टर की प्रति/फोटो, जिसमें वस्तुओं का नाम, संख्या, स्थिति दर्ज हो।',
      'विद्यालय समय-सारिणी (टाइमटेबल) का प्रमाण, जिसमें प्रत्येक कक्षा के लिए नियमित खेल/पीटी अवधि दर्शाई गई हो।',
      'यू-डाइस प्लस (UDISE+) प्रविष्टि, जो विद्यालय में खेल मैदान की उपलब्धता की पुष्टि करे।',
    ],
    itemsEn: [
      'A photo showing sports courts/line markings and children playing.',
      'Copy/photo of the sports equipment stock register, recording item names, quantity, and condition.',
      'Proof of the school timetable, showing a regular sports/PT period for every class.',
      'UDISE+ entry confirming the availability of a playground in the school.',
    ],
  },
  {
    code: '1.1.10',
    itemsHi: [
      'हॉल/सभा क्षेत्र का फोटो, जिसमें बैठने की व्यवस्था, मंच/उठा हुआ प्लेटफॉर्म और उपलब्ध उपकरण दिखें।',
      'वार्षिक कार्यक्रम कैलेंडर/योजना, जिससे स्पष्ट हो कि वर्ष में कम से कम 4-5 कार्यक्रम हॉल/सभा स्थल पर आयोजित होते हैं।',
    ],
    itemsEn: [
      'Photo of the hall/assembly area showing the seating arrangement, stage/raised platform, and available equipment.',
      'Annual event calendar/plan showing that at least 4-5 events are held in the hall/assembly venue every year.',
    ],
  },
  {
    code: '1.1.11',
    itemsHi: [
      'पुस्तकालय या कक्षा के पठन कोने (रीडिंग कॉर्नर) के फोटो, जिनमें किताबें, समाचार पत्र, रैक/शेल्फ पर सुलभ रूप से रखी हों।',
      'पुस्तकालय स्टॉक रजिस्टर की फोटो, जिसमें कुल पुस्तकों की संख्या, श्रेणी/विषय अनुसार विवरण और अंतिम नई पुस्तकों की तिथि दर्ज हो।',
      'पुस्तक निर्गम (इश्यू) रजिस्टर की फोटो, जिसमें पिछले 30 दिनों की प्रविष्टियाँ और विद्यार्थियों को जारी पुस्तकों का विवरण हो।',
      'विद्यालय समय-सारिणी (टाइमटेबल) की फोटो जिसमें प्रत्येक कक्षा के लिए नियमित पुस्तकालय अवधि दर्शाई गई हो।',
      'यू-डाइस प्लस (UDISE+) प्रविष्टि, जो पुस्तकालय की उपलब्धता और पुस्तकों की संख्या की पुष्टि करे।',
    ],
    itemsEn: [
      'Photos of the library or classroom reading corner, showing books and newspapers accessibly placed on racks/shelves.',
      'Photo of the library stock register, recording the total number of books, category/subject-wise details, and the date the newest books were added.',
      'Photo of the book issue register, showing entries from the last 30 days and details of books issued to students.',
      'Photo of the school timetable showing a regular library period for every class.',
      'UDISE+ entry confirming the availability of the library and the number of books.',
    ],
  },
  {
    code: '1.1.12',
    itemsHi: [
      'प्रत्येक उपलब्ध लैब का फोटो, जिसमें उपकरण व्यवस्थित, लेबल लगे शेल्फ पर रखे और कार्यक्षेत्र साफ़ दिखे।',
      'लैब स्टॉक रजिस्टर, जिसमें सभी उपकरणों की सूची, उपलब्ध व कार्यरत वस्तुएं, स्थिति और अंतिम रखरखाव/उपयोग तिथि दर्ज हो।',
      'लैब उपयोग रजिस्टर/समय-सारिणी, जिससे स्पष्ट हो कि संबंधित कक्षाओं द्वारा लैब का नियमित उपयोग (कम से कम साप्ताहिक) होता है।',
      'यू-डाइस प्लस (UDISE+) प्रविष्टि, जो प्रयोगशाला की उपलब्धता/स्थिति और उपकरण उपलब्धता की पुष्टि करे।',
    ],
    itemsEn: [
      'Photo of each available lab, showing equipment arranged and labeled on shelves, with a clean work area.',
      'Lab stock register, recording a list of all equipment, available and functional items, condition, and the date of last maintenance/use.',
      'Lab usage register/timetable, showing that the lab is used regularly (at least weekly) by the relevant classes.',
      'UDISE+ entry confirming the availability/status of the laboratory and the availability of equipment.',
    ],
  },
  {
    code: '1.1.13',
    itemsHi: [
      'लैब का फोटो, जिसमें कंप्यूटरों की संख्या, विद्यार्थियों के बैठने की व्यवस्था और (जहाँ उपलब्ध हो) प्रोजेक्टर/स्मार्टबोर्ड दिखे।',
      'ऐसा फोटो जिसमें विद्यार्थी कंप्यूटर पर कार्य करते हुए दिखें।',
      'इंटरनेट कनेक्टिविटी दर्शाता फोटो (राउटर/वाई-फाई या स्क्रीन पर सक्रिय इंटरनेट/ब्राउज़र)।',
      'कंप्यूटर लैब समय-सारिणी, जिससे स्पष्ट हो कि सभी कक्षाओं के लिए नियमित आईसीटी अवधि निर्धारित है (कम से कम साप्ताहिक)।',
      'लैब उपयोग रजिस्टर (पिछले 30 दिनों का), जिसमें तिथि, कक्षा, विषय/गतिविधि और शिक्षक का नाम दर्ज हो।',
      'यू-डाइस प्लस (UDISE+) प्रविष्टि, जो कंप्यूटर संख्या और इंटरनेट उपलब्धता की पुष्टि करे।',
    ],
    itemsEn: [
      'Photo of the lab, showing the number of computers, student seating arrangement, and (where available) a projector/smart board.',
      'A photo showing students working on computers.',
      'Photo showing internet connectivity (router/Wi-Fi or an active internet/browser on screen).',
      'Computer lab timetable, showing that a regular ICT period is scheduled for all classes (at least weekly).',
      `Lab usage register (for the last 30 days), recording date, class, subject/activity, and teacher's name.`,
      'UDISE+ entry confirming the number of computers and internet availability.',
    ],
  },
  {
    code: '1.1.14',
    itemsHi: [
      'क्रियाशील स्मार्ट क्लास की फोटो।',
      'पाठ योजना (लेसन प्लान) के प्रमाण, जिनमें स्मार्ट क्लास का स्पष्ट शिक्षण उद्देश्य के साथ उपयोग दिखे।',
      'यू-डाइस प्लस (UDISE+) प्रविष्टि, जो स्मार्ट क्लास की उपलब्धता/स्थिति की पुष्टि करे।',
    ],
    itemsEn: [
      'Photo of the functioning smart class.',
      'Proof of lesson plans showing the use of the smart class with a clear teaching objective.',
      'UDISE+ entry confirming the availability/status of the smart class.',
    ],
  },
  {
    code: '1.1.15',
    itemsHi: [
      'स्वास्थ्य जाँच अभिलेख, जिसमें जाँच की तिथि, जाँचे गए विद्यार्थियों की संख्या और पहचानी गई स्वास्थ्य समस्याएँ दर्ज हों।',
      'प्राथमिक उपचार (First Aid) किट का प्रमाण, जिसमें सभी आवश्यक सामग्री उपलब्ध और मान्य तिथि की हो।',
      'यू-डाइस प्लस (UDISE+) प्रविष्टि, जिसमें स्वास्थ्य जाँच और संबंधित स्वास्थ्य विवरण दर्ज हों।',
      'मेडिकल रूम/स्वास्थ्य कक्ष के फोटो।',
    ],
    itemsEn: [
      'Health check-up records, recording the date of the check-up, the number of students examined, and the health problems identified.',
      'Proof of the first-aid kit, showing all necessary items available and within their valid date.',
      'UDISE+ entry recording health check-ups and related health details.',
      'Photo of the medical room/health room.',
    ],
  },
  {
    code: '1.1.16',
    itemsHi: [
      'सैनिटरी पैड वितरण रजिस्टर, जिसमें तिथि, कक्षा/विद्यार्थी संख्या और वितरण करने वाले स्टाफ का नाम हो।',
      'MHM से संबंधित सूचना/IEC सामग्री (पोस्टर, पुस्तिका आदि) के फोटो या नमूने।',
    ],
    itemsEn: [
      'Sanitary pad distribution register, recording date, class/number of students, and the name of the distributing staff member.',
      'Photos or samples of MHM-related information/IEC material (posters, booklets, etc.).',
    ],
  },
  {
    code: '1.1.17',
    itemsHi: [
      'विद्यालय प्रवेश द्वार और अन्य आवश्यक स्थानों (कक्षा ब्लॉक, शौचालय, कार्यालय आदि) पर रैंप की स्थिति के फोटो।',
      'यू-डाइस प्लस (UDISE+) प्रविष्टि, जो रैंप उपलब्धता और CWSN नामांकन की पुष्टि करे।',
    ],
    itemsEn: [
      'Photos of the condition of the ramp at the school entrance and other necessary locations (classroom block, toilets, office, etc.).',
      'UDISE+ entry confirming ramp availability and CWSN enrollment.',
    ],
  },
  {
    code: '1.1.18',
    itemsHi: [
      'हेल्पलाइन डिस्प्ले का स्पष्ट फोटो, जिसमें सभी आवश्यक नंबर बड़े व साफ़ अक्षरों में दिखें (चाइल्डलाइन 1098, फायर 101, एम्बुलेंस 108, पुलिस 112, POCSO हेल्पलाइन, विद्यालय संपर्क) तथा जो दिखाएँ कि हेल्पलाइन डिस्प्ले प्रमुख व दिखाई देने वाले स्थानों पर लगे हैं (मुख्य द्वार, गलियारा, शौचालय के पास, स्टाफ रूम आदि)।',
      'हेल्पलाइन जागरूकता सत्र का उपस्थिति रजिस्टर (तिथि, प्रतिभागी नाम, विषय सहित) और सत्र का फोटो।',
    ],
    itemsEn: [
      'A clear photo of the helpline display, showing all necessary numbers in large, clear letters (Childline 1098, Fire 101, Ambulance 108, Police 112, POCSO helpline, school contact), and showing that the helpline displays are installed in prominent, visible locations (main gate, corridor, near toilets, staff room, etc.).',
      'Attendance register of the helpline awareness session (including date, participant names, topic) and a photo of the session.',
    ],
  },
  {
    code: '1.1.19',
    itemsHi: [
      'रसोई/भोजन पकाने के स्थान का फोटो, जिसमें उसकी वर्तमान स्थिति दिखे।',
      'विद्यार्थियों के भोजन करने के स्थान/बैठने व्यवस्था का साफ़ फोटो।',
      'विद्यार्थियों से प्राप्त नियमित फीडबैक की फोटो।',
      'साप्ताहिक/मासिक एमडीएम मेनू, जिससे भोजन की विविधता स्पष्ट हो।',
      'रसोई क्षेत्र के कीट नियंत्रण (पेस्ट कंट्रोल) का रिकॉर्ड, जिसमें अंतिम उपचार की तिथि व प्रकार दर्ज हो (जहाँ उपलब्ध हो)।',
    ],
    itemsEn: [
      'Photo of the kitchen/cooking area, showing its current condition.',
      `Clear photo of the students' dining area/seating arrangement.`,
      'Photo of regular feedback received from students.',
      'Weekly/monthly MDM (mid-day meal) menu, showing the variety of food.',
      'Record of pest control in the kitchen area, recording the date and type of the last treatment (where available).',
    ],
  },
  {
    code: '1.1.20',
    itemsHi: [
      'किचन गार्डन/बगीचे का फोटो, जिसमें क्यारियाँ और उग रहे पौधे दिखें।',
      'विद्यार्थियों/अन्य (समुदाय) की बागवानी गतिविधि करते हुए फोटो।',
      'इको क्लब रजिस्टर, जिसमें सदस्य सूची, बैठक तिथि और चालू वर्ष की गतिविधियाँ दर्ज हों।',
    ],
    itemsEn: [
      'Photo of the kitchen garden, showing beds and growing plants.',
      'Photo of students/others (community) engaged in gardening activity.',
      'Eco club register, recording the member list, meeting dates, and activities for the current year.',
    ],
  },
  {
    code: '1.1.21',
    itemsHi: [
      'ऐसे फोटो जिनमें कक्षाओं और परिसर में गीले व सूखे कचरे के अलग-अलग कूड़ेदान दिखें।',
      'जहाँ उपलब्ध हो, कम्पोस्ट पिट/वर्मी कम्पोस्ट इकाई का फोटो, जिसमें जैविक कचरे का प्रबंधन दिखे।',
      'इको क्लब/बाल संसद गतिविधि अभिलेख, जिसमें कचरा प्रबंधन से जुड़ी विद्यार्थी गतिविधि (तिथि व प्रतिभागी सहित) दर्ज हो।',
    ],
    itemsEn: [
      'Photos showing separate dustbins for wet and dry waste in classrooms and on the premises.',
      'Where available, photo of the compost pit/vermicompost unit, showing management of organic waste.',
      'Eco club/child parliament activity record, recording student activity related to waste management (including date and participants).',
    ],
  },
  {
    code: '1.1.22',
    itemsHi: [
      'विद्यालय के बिजली कनेक्शन का प्रमाण (बिजली बिल/कनेक्शन दस्तावेज़) या मीटर की फोटो।',
      'कम से कम 5 कक्षाओं के फोटो, जिनमें सुरक्षित वायरिंग, ढके स्विचबोर्ड और क्रियाशील लाइट-पंखे दिखें।',
      'जहाँ उपलब्ध हो, सोलर पैनल/जेनरेटर/इन्वर्टर का फोटो, जिससे बैकअप व्यवस्था कार्यरत दिखे।',
      'यू-डाइस प्लस (UDISE+) प्रविष्टि, जो विद्यालय में विद्युत व बैकअप उपलब्धता की पुष्टि करे।',
    ],
    itemsEn: [
      `Proof of the school's electricity connection (electricity bill/connection document) or photo of the meter.`,
      'Photos of at least 5 classrooms, showing safe wiring, covered switchboards, and functioning lights and fans.',
      'Where available, photo of the solar panel/generator/inverter, showing the backup arrangement is functional.',
      'UDISE+ entry confirming the availability of electricity and backup in the school.',
    ],
  },
  {
    code: '1.2.1',
    itemsHi: [
      'परिसर में लगे सीसीटीवी कैमरों के फोटो, जिनमें उनकी स्थिति व स्थान दिखे।',
      'डीवीआर/एनवीआर मॉनिटर स्क्रीन का फोटो, जिसमें लाइव या रिकॉर्डेड फुटेज दिखे।',
    ],
    itemsEn: [
      'Photos of CCTV cameras installed on the premises, showing their condition and location.',
      'Photo of the DVR/NVR monitor screen, showing live or recorded footage.',
    ],
  },
  {
    code: '1.2.2',
    itemsHi: [
      'गेट पर तैनात सुरक्षा कर्मी/नामित स्टाफ की फोटो, जिसमें प्रवेश की निगरानी होती दिखे।',
      'आगंतुक रजिस्टर की फोटो, जिसमें गत 15 दिनों की प्रविष्टियाँ स्पष्ट दिखें (नाम, उद्देश्य, प्रवेश-समय, निकास-समय, हस्ताक्षर)।',
    ],
    itemsEn: [
      'Photo of the security personnel/designated staff posted at the gate, showing that entry is being monitored.',
      'Photo of the visitor register, clearly showing entries from the last 15 days (name, purpose, entry time, exit time, signature).',
    ],
  },
  {
    code: '1.2.3',
    itemsHi: [
      'विद्यालय बाउंड्री वॉल की फोटो, जिसमें उसकी पूरी स्थिति दिखे।',
      'प्रत्येक गेट/प्रवेश-निकास बिंदु के फोटो, जिनमें सुरक्षा व्यवस्था दिखे।',
      'गेट पर रखे आगंतुक रजिस्टर या प्रवेश निगरानी का फोटो।',
    ],
    itemsEn: [
      'Photo of the school boundary wall, showing its overall condition.',
      'Photos of each gate/entry-exit point, showing the security arrangement.',
      'Photo of the visitor register or entry monitoring kept at the gate.',
    ],
  },
  {
    code: '1.2.4',
    itemsHi: [
      'अग्निशामक यंत्रों के फोटो (वैध टैग और गेज स्पष्ट)।',
      'फायर एग्जिट/निकासी मार्ग (एवैक्यूएशन प्लान) के फोटो।',
      'फायर मॉक ड्रिल के फोटो (तिथि सहित)।',
      'वैध अग्नि सुरक्षा निरीक्षण प्रमाणपत्र।',
      'प्रशिक्षण अभिलेख (स्टाफ उपस्थिति/फोटो)।',
    ],
    itemsEn: [
      'Photos of fire extinguishers (valid tags and gauges clearly visible).',
      'Photos of fire exits/evacuation routes (evacuation plan).',
      'Photos of the fire mock drill (with date).',
      'Valid fire safety inspection certificate.',
      'Training records (staff attendance/photos).',
    ],
  },
  {
    code: '1.2.5',
    itemsHi: [
      'विस्तृत आपातकालीन योजना की प्रति, जिसमें आग, भूकंप, बाढ़ आदि स्थितियों के लिए स्टाफ की भूमिकाएँ, निकासी मार्ग, एकत्रीकरण स्थल और अभिभावक सूचना प्रक्रिया दर्ज हो।',
      'स्टाफ उन्मुखीकरण/प्रशिक्षण सत्र का उपस्थिति रजिस्टर (नाम, पद, तिथि, हस्ताक्षर), एजेंडा और सत्र के फोटो।',
      'चालू वर्ष में आयोजित मॉक ड्रिल/आपदा अभ्यास के अभिलेख (कम से कम 2-4), जिनमें तिथि, प्रकार, कक्षा-वार प्रतिभागी, निकासी समय, सुधार बिंदु और फोटो हों।',
      'विद्यार्थी सुरक्षा दल/स्टूडेंट सेफ्टी ब्रिगेड की सदस्य सूची (नाम, कक्षा, भूमिका) और उनके प्रशिक्षण का उपस्थिति रजिस्टर व फोटो (जहाँ उपलब्ध हो)।',
    ],
    itemsEn: [
      'Copy of the detailed emergency plan, recording staff roles, evacuation routes, assembly points, and the parent notification procedure for situations such as fire, earthquake, flood, etc.',
      'Attendance register of the staff orientation/training session (name, position, date, signature), agenda, and photos of the session.',
      'Records of mock drills/disaster exercises held in the current year (at least 2-4), including date, type, class-wise participants, evacuation time, points for improvement, and photos.',
      'Member list (name, class, role) of the student safety team/student safety brigade, and their training attendance register and photos (where available).',
    ],
  },
  {
    code: '1.2.6',
    itemsHi: [
      'समिति गठन आदेश और सदस्यों की सूची।',
      'समिति बैठक के अभिलेख (उपस्थिति, कार्यवृत्त, फोटो)।',
      'बाल संरक्षण कार्ययोजना (गतिविधियाँ एवं समयरेखा)।',
      'स्टाफ प्रशिक्षण एवं विद्यार्थी जागरूकता सत्रों के अभिलेख/फोटो।',
      'शिकायत निस्तारण अभिलेख (तिथि एवं स्थिति)',
    ],
    itemsEn: [
      'Committee formation order and list of members.',
      'Records of committee meetings (attendance, minutes, photos).',
      'Child protection action plan (activities and timeline).',
      'Records/photos of staff training and student awareness sessions.',
      'Complaint resolution records (date and status).',
    ],
  },
  {
    code: '2.1.1',
    itemsHi: [
      'यू-डाइस प्लस (UDISE+) प्रविष्टि, जिसमें कुल नामांकन और कुल शिक्षक संख्या से पीटीआर (PTR) की स्थिति स्पष्ट हो।',
      'शिक्षक उपस्थिति रजिस्टर, जिसमें स्वीकृत पद, कार्यरत शिक्षक और वर्तमान माह के कम से कम 5 दिनों की उपस्थिति दिखाई दे।',
      'विद्यार्थी उपस्थिति पंजिका।',
    ],
    itemsEn: [
      'UDISE+ entry showing the PTR status clearly from the total enrollment and total number of teachers.',
      'Teacher attendance register, showing sanctioned posts, teachers in position, and attendance for at least 5 days of the current month.',
      'Student attendance register.',
    ],
  },
  {
    code: '2.1.2',
    itemsHi: [
      'यू-डाइस प्लस (UDISE+) प्रविष्टि, जिसमें शिक्षक की योग्यता और उनके द्वारा पढ़ाए जा रहे विषय का मिलान स्पष्ट हो।',
      'प्रेरणा पोर्टल (Prerna Portal) शिक्षक प्रोफाइल, जिसमें सभी शिक्षकों की शैक्षणिक योग्यता और विषय आवंटन दर्ज हो।',
      'मानव सम्पदा से शिक्षकों का विषयवार विवरण।',
    ],
    itemsEn: [
      `UDISE+ entry clearly showing the match between the teacher's qualification and the subject they are teaching.`,
      'Prerna Portal teacher profile, recording the academic qualification and subject allocation of all teachers.',
      'Subject-wise details of teachers from Manav Sampada.',
    ],
  },
  {
    code: '2.1.3',
    itemsHi: [
      'यू-डाइस प्लस (UDISE+) प्रविष्टि, जिसमें स्वीकृत गैर-शिक्षण पद, भरे पद और रिक्तियाँ स्पष्ट हों।',
      'गैर-शिक्षण स्टाफ उपस्थिति रजिस्टर (पिछले 30 दिनों का), जिससे वास्तविक उपस्थिति स्थिति दिखे।',
    ],
    itemsEn: [
      'UDISE+ entry clearly showing sanctioned non-teaching posts, filled posts, and vacancies.',
      'Non-teaching staff attendance register (for the last 30 days), showing the actual attendance status.',
    ],
  },
  {
    code: '2.1.4',
    itemsHi: [
      'गैर-शैक्षणिक स्टाफ उपस्थिति रजिस्टर (पिछले 30 दिनों का), जिससे वास्तविक उपस्थिति स्थिति दिखे।',
      'संदर्भ (Referral) अभिलेख जिससे उपस्थित एवं कार्य प्रमाणित किया जा सके।',
    ],
    itemsEn: [
      'Non-teaching staff attendance register (for the last 30 days), showing the actual attendance status.',
      'Referral records to certify presence and work.',
    ],
  },
  {
    code: '2.1.5',
    itemsHi: [
      'परामर्शदाता उपस्थिति अभिलेख (पार्ट-टाइम हेतु: वर्तमान सत्र में आने के दिन व समय; फुल-टाइम हेतु: पिछले 30 दिनों की नियमित उपस्थिति)।',
      'परामर्श सत्र अभिलेख, जिसमें मिले विद्यार्थियों की संख्या, समस्या का प्रकार और सत्र की तिथि/आवृत्ति दर्ज हो।',
      'संदर्भ (Referral) अभिलेख, जिसमें बाहरी सहायता हेतु भेजे गए मामलों और अनुवर्ती कार्यवाही का विवरण हो (जहाँ लागू हो)।',
    ],
    itemsEn: [
      'Counsellor attendance record (for part-time: days and times attended in the current session; for full-time: regular attendance for the last 30 days).',
      'Counselling session records, recording the number of students met, type of problem, and the date/frequency of sessions.',
      'Referral records, showing details of cases referred for external help and follow-up action (where applicable).',
    ],
  },
  {
    code: '2.1.6',
    itemsHi: [
      'गैर-शिक्षण स्टाफ उपस्थिति रजिस्टर (पिछले 30 दिनों का), जिससे औसत उपस्थिति दर स्पष्ट हो।',
      'प्रेरणा पोर्टल (Prerna Portal) उपस्थिति डेटा (जहाँ लागू हो), जिसका रजिस्टर से मिलान किया गया हो।',
    ],
    itemsEn: [
      'Non-teaching staff attendance register (for the last 30 days), showing the average attendance rate clearly.',
      'Prerna Portal attendance data (where applicable), cross-checked against the register.',
    ],
  },
  {
    code: '2.1.7',
    itemsHi: [
      'शिक्षक उपस्थिति रजिस्टर (पिछले 30 दिनों का), जिससे औसत उपस्थिति दर स्पष्ट हो।',
      'प्रेरणा पोर्टल (Prerna Portal) उपस्थिति डेटा, जिसका भौतिक रजिस्टर से मिलान किया गया हो और किसी अंतर का उल्लेख हो।',
      'समय सारणी के अनुसार शिक्षण कार्य का अवलोकन।',
    ],
    itemsEn: [
      'Teacher attendance register (for the last 30 days), showing the average attendance rate clearly.',
      'Prerna Portal attendance data, cross-checked against the physical register, with any discrepancy noted.',
      'Observation of teaching work as per the timetable.',
    ],
  },
  {
    code: '2.2.1',
    itemsHi: [
      'प्रधानाध्यापक की डायरी/शिक्षण योजना।',
      'समय सारणी।',
    ],
    itemsEn: [
      `Head teacher's diary/teaching plan.`,
      'Timetable.',
    ],
  },
  {
    code: '2.2.2',
    itemsHi: [
      'पिछले 12 महीनों में शिक्षकों द्वारा लिए गए सभी प्रशिक्षणों की सूची (प्रशिक्षण नाम, तिथि, विषय, प्रदाता, शिक्षक नाम सहित)।',
      'वार्षिक शिक्षक व्यावसायिक विकास योजना।',
      'प्रत्येक प्रशिक्षण का उपस्थिति रजिस्टर, एजेंडा, प्रमाणपत्र और प्रशिक्षण के फोटो।',
      'प्रशिक्षण के बाद आयोजित स्टाफ बैठक का एजेंडा और उपस्थिति।',
    ],
    itemsEn: [
      `List of all trainings taken by teachers in the last 12 months (including training name, date, subject, provider, teacher's name).`,
      'Annual teacher professional development plan.',
      'Attendance register, agenda, certificate, and photos for each training.',
      'Agenda and attendance of the staff meeting held after the training.',
    ],
  },
  {
    code: '2.2.3',
    itemsHi: [
      'कक्षा निरीक्षण/प्रधानाध्यापक निरीक्षण रजिस्टर।',
      'शिक्षक डायरी/लेसन प्लान पर प्रधानाध्यापक की टिप्पणी या हस्ताक्षर।',
      'शिक्षकों को दिए गए लिखित फीडबैक नोट्स।',
      'स्टाफ शैक्षणिक समीक्षा बैठकों का उपस्थिति रजिस्टर, एजेंडा और कार्यवृत्त।',
      'चालू वर्ष की शैक्षणिक समीक्षा बैठकों के फोटो (कम से कम 2-3)।',
    ],
    itemsEn: [
      'Classroom inspection/head-teacher inspection register.',
      `Head teacher's comments or signature on teacher diary/lesson plans.`,
      'Written feedback notes given to teachers.',
      'Attendance register, agenda, and minutes of staff academic review meetings.',
      'Photos of academic review meetings held in the current year (at least 2-3).',
    ],
  },
  {
    code: '2.2.4',
    itemsHi: [
      'POSH समिति/LCC गठन आदेश एवं सदस्यों की सूची।',
      'प्रदर्शित POSH नीति/LCC सूचना के फोटो।',
      'समिति बैठकों के अभिलेख।',
      'स्टाफ प्रशिक्षण अभिलेख/फोटो।',
      'शिकायत रजिस्टर/निस्तारण अभिलेख।',
    ],
    itemsEn: [
      'POSH committee/LCC formation order and list of members.',
      'Photos of the displayed POSH policy/LCC information.',
      'Records of committee meetings.',
      'Staff training records/photos.',
      'Complaint register/resolution records.',
    ],
  },
  {
    code: '2.2.5',
    itemsHi: [
      'सराहना/प्रशंसा प्रमाणपत्रों की प्रतियाँ।',
      'सराहना/सम्मान के अवसर के फोटो।',
      'प्रधानाध्यापक निरीक्षण रजिस्टर के उल्लेख।',
    ],
    itemsEn: [
      'Copies of appreciation/commendation certificates.',
      'Photos of appreciation/felicitation occasions.',
      `Mentions in the head teacher's inspection register.`,
    ],
  },
  {
    code: '2.2.6',
    itemsHi: [
      'यू-डाइस प्लस (UDISE+) रिपोर्ट जिसमें कक्षावार नामांकन एवं प्रगमन (Transition) संबंधी आंकड़े उपलब्ध हों।',
      'विद्यालय नामांकन पंजिका (Admission Register)।',
      'कैचमेंट एरिया सर्वे/विद्यालय आयुवर्ग के बच्चों का सर्वेक्षण अभिलेख।',
      'कक्षा 5 से 6, कक्षा 8 से 9 एवं कक्षा 12 के बाद उच्च शिक्षा संस्थानों में प्रवेश लेने वाले विद्यार्थियों की सत्यापित सूची/रिकॉर्ड।',
      'विद्यालय त्याग (Dropout), स्थानांतरण (Transfer) एवं पुनः नामांकन (Re-enrolment) संबंधी अभिलेख।',
    ],
    itemsEn: [
      'UDISE+ report with class-wise enrollment and transition data available.',
      'School admission register.',
      'Catchment area survey/survey record of school-age children.',
      'Verified list/record of students who took admission in higher education institutions after class 5 to 6, class 8 to 9, and after class 12.',
      'Records related to dropout, transfer, and re-enrolment.',
    ],
  },
  {
    code: '3.1.1',
    itemsHi: [
      'समस्त कक्षाओं की 2-2 विषयवार विद्यार्थियों द्वारा बनायी गयी विषय पुस्तिकाओं के फोटो।',
      'सभी शिक्षकों की वार्षिक शिक्षण योजना।',
      'शिक्षण योजनाएँ जो वार्षिक शिक्षण योजना से जुड़ी हों।',
    ],
    itemsEn: [
      'Photos of 2 subject-wise notebooks made by students from every class.',
      'Annual teaching plan of all teachers.',
      'Lesson plans that are linked to the annual teaching plan.',
    ],
  },
  {
    code: '3.1.2',
    itemsHi: [
      'शिक्षण योजनाएँ जिनमें तिथि, पाठ का उद्देश्य, गतिविधियाँ, सामग्री और सीखने की जाँच का उल्लेख हो।',
      'शिक्षक डायरी, जिसमें शिक्षण योजनाओं पर प्रधानाध्यापक की नियमित टिप्पणी/फीडबैक दर्ज हो।',
    ],
    itemsEn: [
      'Lesson plans that mention date, lesson objective, activities, materials, and a check for learning.',
      `Teacher diary, recording the head teacher's regular comments/feedback on lesson plans.`,
    ],
  },
  {
    code: '3.1.3',
    itemsHi: [
      'शिक्षण योजनाएँ, जिनमें गतिविधि-आधारित कार्य मुख्य भाग के रूप में दर्ज हों।',
      'कक्षा में उपयोग हो रही टीएलएम के फोटो।',
      'विद्यार्थियों के कार्य के फोटो/नमूने (कम से कम 5 कक्षाओं से)।',
    ],
    itemsEn: [
      'Lesson plans, in which activity-based work is recorded as a main component.',
      'Photos of TLM (teaching-learning material) being used in the classroom.',
      `Photos/samples of students' work (from at least 5 classrooms).`,
    ],
  },
  {
    code: '3.1.4',
    itemsHi: [
      'शिक्षण योजनाएँ, जिनमें आईसीटी/डिजिटल उपकरण के उपयोग का उल्लेख और उसका उद्देश्य दर्ज हो।',
      'आईसीटी/स्मार्ट क्लास उपयोग का विवरण।',
    ],
    itemsEn: [
      'Lesson plans, recording the use of ICT/digital tools and their purpose.',
      'Details of ICT/smart class usage.',
    ],
  },
  {
    code: '3.1.5',
    itemsHi: [
      'प्रशिक्षण संस्था से प्री-वोकेशनल प्रोग्राम के लिए औपचारिक समझौता या जुड़ाव का अभिलेख।',
      'विद्यार्थियों को प्राप्त प्री-वोकेशनल प्रमाणपत्र।',
      'वार्षिक प्री-वोकेशनल इंटीग्रेटेड प्रोग्राम योजना।',
      'विद्यार्थियों के कौशल कार्य के नमूने/उत्पाद।',
    ],
    itemsEn: [
      'Record of a formal agreement or engagement with a training institution for the pre-vocational programme.',
      'Pre-vocational certificates received by students.',
      'Annual pre-vocational integrated programme plan.',
      `Samples/products of students' skill work.`,
    ],
  },
  {
    code: '3.1.6',
    itemsHi: [
      'प्रशिक्षण संस्था से औपचारिक समझौता या जुड़ाव का अभिलेख।',
      'विद्यार्थियों को प्राप्त कौशल प्रमाणपत्र।',
      'वार्षिक व्यावसायिक/कौशल पाठ्यक्रम योजना।',
      'विद्यार्थियों के कौशल कार्य के नमूने/उत्पाद।',
    ],
    itemsEn: [
      'Record of a formal agreement or engagement with a training institution.',
      'Skill certificates received by students.',
      'Annual vocational/skill curriculum plan.',
      `Samples/products of students' skill work.`,
    ],
  },
  {
    code: '3.1.7',
    itemsHi: [
      'शिक्षण योजनाएँ/शिक्षक डायरी, जिनमें मातृभाषा एवं स्थानीय उदाहरणों/संदर्भों का उल्लेख हो।',
      'कक्षा अवलोकन/फोटो/वीडियो।',
      'विद्यार्थियों की कॉपियाँ/कार्यनमूने।',
      'कक्षा में प्रदर्शित TLM जो स्थानीय भाषा/संदर्भ से जुड़े हों।',
      'गतिविधियों/कार्यक्रमों का अभिलेख या फोटो।',
    ],
    itemsEn: [
      'Lesson plans/teacher diary, mentioning mother tongue and local examples/context.',
      'Classroom observation/photos/videos.',
      `Students' notebooks/work samples.`,
      'TLM displayed in the classroom that is linked to local language/context.',
      'Records or photos of activities/programmes.',
    ],
  },
  {
    code: '3.1.8',
    itemsHi: [
      'शिक्षण योजनाएँ जिनमें इन विषयों से जुड़ी सामग्री/गतिविधि का उल्लेख हो।',
      'कक्षाओं में प्रदर्शित पोस्टर, चार्ट या विद्यार्थियों के कार्य के फोटो।',
      'विद्यार्थियों के कार्य के नमूने/फोटो।',
      'प्रार्थना सभा/विद्यालय गतिविधि अभिलेख।',
    ],
    itemsEn: [
      'Lesson plans mentioning content/activity related to these topics.',
      `Photos of posters, charts, or students' work displayed in classrooms.`,
      `Samples/photos of students' work.`,
      'Assembly/school activity records.',
    ],
  },
  {
    code: '3.2.1',
    itemsHi: [
      'शिक्षण योजनाएँ जिनमें सहभागिता रणनीतियाँ दर्ज हों।',
      'विद्यार्थियों की कॉपियाँ/कार्यनमूने।',
      'सम्बंधित गतिविधियों के वीडियो एवं फोटोग्राफ्स।',
    ],
    itemsEn: [
      'Lesson plans recording participation strategies.',
      `Students' notebooks/work samples.`,
      'Videos and photographs of related activities.',
    ],
  },
  {
    code: '3.2.2',
    itemsHi: [
      'शिक्षण योजनाएँ जिनमें समय-विभाजन और कक्षा प्रबंधन रणनीतियाँ दर्ज हों।',
      'कक्षा प्रबंधन के वीडियो एवं फोटोग्राफ्स।',
    ],
    itemsEn: [
      'Lesson plans recording time allocation and classroom management strategies.',
      'Videos and photographs of classroom management.',
    ],
  },
  {
    code: '3.2.3',
    itemsHi: [
      'विद्यार्थी उपस्थिति रजिस्टर (पिछले 6 माह का), जिससे औसत उपस्थिति दर स्पष्ट हो।',
    ],
    itemsEn: [
      'Student attendance register (for the last 6 months), showing the average attendance rate clearly.',
    ],
  },
  {
    code: '3.2.4',
    itemsHi: [
      'शिक्षण योजनाएँ, जिनमें उच्च स्तरीय प्रश्न या चिंतनशील चर्चा प्रश्न सम्मिलित हों।',
      'विभिन्न कक्षाओं एवं विषयों से सम्बंधित प्रश्न पत्र।',
      'समस्त कक्षों की एवं सभी विषयों की 1-1 विषय पुस्तिकाएं एवं कुछ विद्यार्थियों की परीक्षा की उत्तर पुस्तिकाएं।',
    ],
    itemsEn: [
      'Lesson plans that include higher-order questions or reflective discussion questions.',
      'Question papers related to different classes and subjects.',
      `One subject notebook each from every class and every subject, and some students' exam answer sheets.`,
    ],
  },
  {
    code: '3.2.5',
    itemsHi: [
      'शिक्षण योजनाएँ जिनमें अलग-अलग स्तर के विद्यार्थियों के लिए रणनीतियाँ दर्ज हों।',
      'विद्यार्थियों के व्यक्तिगत प्रगति अभिलेख/रिकॉर्ड।',
      'वीडियो एवं फोटोग्राफ्स।',
    ],
    itemsEn: [
      'Lesson plans recording strategies for students at different levels.',
      'Individual progress records of students.',
      'Videos and photographs.',
    ],
  },
  {
    code: '3.2.6',
    itemsHi: [
      'यू-डाइस प्लस (UDISE+) प्रविष्टि, जिसमें CWSN विद्यार्थियों की संख्या, उपस्थिति और सहयोग का विवरण दर्ज हो।',
      'CWSN विद्यार्थियों के लिए व्यक्तिगत सहायता/समायोजन योजना।',
      'कक्षा में उपलब्ध सहायक/अनुकूल शिक्षण सामग्री के फोटो।',
    ],
    itemsEn: [
      'UDISE+ entry, recording the number, attendance, and support details of CWSN students.',
      'Individual support/accommodation plan for CWSN students.',
      'Photos of assistive/adapted teaching materials available in the classroom.',
    ],
  },
  {
    code: '3.2.7',
    itemsHi: [
      'विद्यार्थियों की कॉपियाँ/कार्यनमूने, जिनमें पाठ के बीच की जाँच गतिविधियाँ दिखाई दें।',
      'शिक्षण योजनाएँ।',
      'विडियो एवं फोटोग्राफ्स।',
      'विद्यार्थियों के गृह कार्य पुस्तिका एवं यूनिट टेस्ट के परिणाम।',
    ],
    itemsEn: [
      `Students' notebooks/work samples, showing check-for-understanding activities during the lesson.`,
      'Lesson plans.',
      'Videos and photographs.',
      `Students' homework notebooks and unit test results.`,
    ],
  },
  {
    code: '3.2.8',
    itemsHi: [
      'कक्षाओं में प्रदर्शित और उपयोग हो रहे टीएलएम के फोटो।',
      'शिक्षण योजना जिसमें TLM उपयोग का विवरण दिया गया हो।',
    ],
    itemsEn: [
      'Photos of TLM displayed and being used in classrooms.',
      'Lesson plan detailing the use of TLM.',
    ],
  },
  {
    code: '3.2.9',
    itemsHi: [
      'विद्यार्थियों की 5-6 कॉपियों की जाँच का रिकॉर्ड/नमूने।',
      'शिक्षण योजनाएँ जिनमें फीडबैक देने का चरण/रणनीति दर्ज हो।',
      'आकलन मानदंड/रूब्रिक के प्रमाण/फोटो।',
    ],
    itemsEn: [
      `Record/samples of checking 5-6 students' notebooks.`,
      'Lesson plans recording the stage/strategy for giving feedback.',
      'Proof/photos of assessment criteria/rubric.',
    ],
  },
  {
    code: '3.2.10',
    itemsHi: [
      'विद्यार्थियों की कॉपियाँ/फाइलें जाँच का रिकॉर्ड।',
      'विद्यार्थियों के रचनात्मक/प्रोजेक्ट कार्य के फोटो।',
      'शिक्षण योजनाएँ जिनमें रचनात्मक या प्रोजेक्ट गतिविधियाँ सम्मिलित हों।',
      'विभिन्न विद्यार्थियों के कार्यों के फोटो।',
    ],
    itemsEn: [
      `Record of checking students' notebooks/files.`,
      `Photos of students' creative/project work.`,
      'Lesson plans that include creative or project activities.',
      'Photos of work by different students.',
    ],
  },
  {
    code: '3.2.11',
    itemsHi: [
      'विद्यालय समय-सारिणी का प्रमाण।',
      'साक्ष्य: पाठ अवधि का कितना समय वास्तविक शिक्षण में और कितना समय प्रशासनिक कार्य/व्यवधान में गया।',
      'विद्यार्थियों की कापियों के नमूने।',
    ],
    itemsEn: [
      'Proof of the school timetable.',
      'Evidence: how much of the lesson period was spent on actual teaching versus administrative work/interruptions.',
      `Samples of students' notebooks.`,
    ],
  },
  {
    code: '3.3.1',
    itemsHi: [
      'शिक्षण योजनाएं जिससे स्पष्ट हो कि सभी कक्षाओं के लिए SEL कार्यक्रम निर्धारित है।',
      'SEL गतिविधियों के फोटोग्राफ्स।',
    ],
    itemsEn: [
      'Lesson plans showing that an SEL programme is scheduled for all classes.',
      'Photographs of SEL activities.',
    ],
  },
  {
    code: '3.3.2',
    itemsHi: [
      'विद्यालय समय-सारिणी।',
      'वार्षिक सह-पाठ्यक्रम योजना।',
      'सह-पाठ्यक्रम सत्रों के उपस्थिति रजिस्टर।',
      'विभिन्न गतिविधियों के सत्रों के फोटो।',
    ],
    itemsEn: [
      'School timetable.',
      'Annual co-curricular plan.',
      'Attendance register of co-curricular sessions.',
      'Photos of sessions for various activities.',
    ],
  },
  {
    code: '3.3.3',
    itemsHi: [
      'प्रत्येक भ्रमण के लिए विभागीय आदेश/पत्र।',
      'भ्रमण पूर्व योजना।',
      'अभिभावक सहमति प्रपत्र और विद्यार्थी सहभागिता सूची।',
      'प्रत्येक भ्रमण के फोटो (कम से कम 8-10)।',
      'भ्रमण पश्चात विद्यार्थी कार्य के नमूने।',
    ],
    itemsEn: [
      'Departmental order/letter for each trip.',
      'Pre-trip plan.',
      'Parent consent forms and student participation list.',
      'Photos of each trip (at least 8-10).',
      `Samples of students' work after the trip.`,
    ],
  },
  {
    code: '3.3.4',
    itemsHi: [
      'खेल प्रतियोगिता कार्यक्रम/अनुसूची।',
      'परिणाम अभिलेख या प्रमाणपत्र की प्रतियाँ।',
      'विभिन्न खेल प्रतियोगिताओं के फोटो।',
    ],
    itemsEn: [
      'Sports competition programme/schedule.',
      'Result records or copies of certificates.',
      'Photos of various sports competitions.',
    ],
  },
  {
    code: '3.3.5',
    itemsHi: [
      'वार्षिक कार्यक्रम कैलेंडर।',
      'जारी प्रमाणपत्र।',
      'विभिन्न प्रतियोगिताओं के फोटो।',
    ],
    itemsEn: [
      'Annual event calendar.',
      'Certificates issued.',
      'Photos of various competitions.',
    ],
  },
  {
    code: '3.3.6',
    itemsHi: [
      'प्रार्थना सभा रजिस्टर।',
      'हाल की सभाओं का कार्यक्रम विवरण/रिकॉर्ड।',
      'विद्यालय के सभी हाउस/क्लब की सूची।',
      'हाउस/क्लब बैठक रजिस्टर।',
      'हाउस/क्लब गतिविधियों या बैठकों के फोटो।',
      'विद्यार्थी-प्रेरित परियोजना/गतिविधि अभिलेख।',
    ],
    itemsEn: [
      'Assembly register.',
      'Programme details/records of recent assemblies.',
      'List of all houses/clubs in the school.',
      'House/club meeting register.',
      'Photos of house/club activities or meetings.',
      'Records of student-initiated projects/activities.',
    ],
  },
  {
    code: '3.3.7',
    itemsHi: [
      'वार्षिक कार्यक्रम कैलेंडर।',
      'प्रत्येक आयोजन की विस्तृत योजना (विद्यार्थी प्रतिभागिता सूची, फोटो)।',
      'अभिभावक/समुदाय उपस्थिति अभिलेख।',
    ],
    itemsEn: [
      'Annual event calendar.',
      'Detailed plan for each event (student participation list, photos).',
      'Parent/community attendance records.',
    ],
  },
  {
    code: '3.3.8',
    itemsHi: [
      'सूचना/गतिविधि रजिस्टर।',
      'प्रत्येक प्रमुख त्योहार की आयोजन योजना।',
      'प्रतिभागिता सूची।',
      'प्रत्येक कार्यक्रम के फोटो।',
      'त्योहार से जुड़े विद्यार्थी कार्य के नमूने।',
    ],
    itemsEn: [
      'Information/activity register.',
      'Organizing plan for each major festival.',
      'Participation list.',
      'Photos of each event.',
      `Samples of students' work related to the festival.`,
    ],
  },
  {
    code: '4.1.1',
    itemsHi: [
      'वार्षिक आकलन योजना/कार्यक्रम।',
      'विभिन्न प्रकार के आकलन के प्रश्नपत्र और जाँची गई उत्तरपुस्तिकाएँ।',
      'अंक रजिस्टर।',
      'प्रेरणा पोर्टल (Prerna Portal) डेटा।',
    ],
    itemsEn: [
      'Annual assessment plan/schedule.',
      'Question papers of different types of assessment and checked answer sheets.',
      'Marks register.',
      'Prerna Portal data.',
    ],
  },
  {
    code: '4.1.2',
    itemsHi: [
      'कॉपियों के नमूने, जिनमें स्पष्ट और विशिष्ट फीडबैक दिखे।',
      'विद्यार्थियों के कार्य में सुधार के प्रमाण।',
    ],
    itemsEn: [
      'Samples of notebooks showing clear and specific feedback.',
      `Evidence of improvement in students' work.`,
    ],
  },
  {
    code: '4.1.3',
    itemsHi: [
      'आकलन परिणाम विश्लेषण दस्तावेज़।',
      'शिक्षकों के साथ डेटा समीक्षा बैठकों का उपस्थिति रजिस्टर।',
      'डेटा के आधार पर बनी कार्ययोजना।',
    ],
    itemsEn: [
      'Assessment result analysis document.',
      'Attendance register of data review meetings with teachers.',
      'Action plan built on the basis of the data.',
    ],
  },
  {
    code: '4.1.4',
    itemsHi: [
      'विद्यार्थियों के पोर्टफोलियो या रिफ्लेक्शन के नमूने/फोटो।',
      'शिक्षण योजनाएँ।',
      'विद्यार्थियों के कार्यसंग्रह/फाइलें।',
    ],
    itemsEn: [
      `Samples/photos of students' portfolios or reflections.`,
      'Lesson plans.',
      `Students' work collections/files.`,
    ],
  },
  {
    code: '4.1.5',
    itemsHi: [
      'सीखने में कमी वाले विद्यार्थियों की सूची।',
      'प्रत्येक चिन्हित विद्यार्थी के लिए व्यक्तिगत सीख समर्थन योजना।',
      'विद्यार्थियों के कार्यपत्र/अभ्यास सामग्री के नमूने।',
      'सुधार से पहले और बाद के प्रदर्शन का तुलना रिकॉर्ड।',
    ],
    itemsEn: [
      'List of students with learning gaps.',
      'Individual learning support plan for each identified student.',
      `Samples of students' worksheets/practice material.`,
      'Comparison record of performance before and after the remediation.',
    ],
  },
  {
    code: '4.2.1',
    itemsHi: [
      'पिछले वार्षिक परीक्षा परिणाम (कक्षा-वार)।',
      'पिछले 3 वर्षों के वार्षिक परिणामों की तुलना।',
    ],
    itemsEn: [
      `Previous year's annual exam results (class-wise).`,
      'Comparison of annual results over the last 3 years.',
    ],
  },
  {
    code: '4.2.2',
    itemsHi: [
      'एफ.एल.एन. आकलन अभिलेख।',
      'विद्यार्थियों के कार्य नमूने।',
      'कक्षा अवलोकन।',
      'प्रगति रजिस्टर/रिकॉर्ड।',
    ],
    itemsEn: [
      'FLN assessment records.',
      `Samples of students' work.`,
      'Classroom observation.',
      'Progress register/record.',
    ],
  },
  {
    code: '4.2.3',
    itemsHi: [
      'पिछले वर्ष के कक्षा 10 और 12 बोर्ड परिणाम।',
      'पिछले 3 वर्षों के बोर्ड परिणामों की तुलना।',
    ],
    itemsEn: [
      `Last year's class 10 and 12 board results.`,
      'Comparison of board results over the last 3 years.',
    ],
  },
  {
    code: '4.2.4',
    itemsHi: [
      'विद्यालय अभिलेख।',
      'विवरण के साथ सफल विद्यार्थियों की सूची।',
    ],
    itemsEn: [
      'School records.',
      'List of successful students with details.',
    ],
  },
  {
    code: '4.2.5',
    itemsHi: [
      'विद्यालय अभिलेख।',
      'विवरण के साथ सफल विद्यार्थियों की सूची।',
    ],
    itemsEn: [
      'School records.',
      'List of successful students with details.',
    ],
  },
  {
    code: '4.2.6',
    itemsHi: [
      'विद्यालय अभिलेख।',
      'विवरण के साथ सफल विद्यार्थियों की सूची।',
    ],
    itemsEn: [
      'School records.',
      'List of successful students with details.',
    ],
  },
  {
    code: '5.1.1',
    itemsHi: [
      'सहायक शैक्षिक तकनीक/उपकरण की उपलब्धता एवं उपयोग के प्रमाण।',
      'विशेष शिक्षकों की उपस्थिति एवं तैनाती से संबंधित अभिलेख।',
    ],
    itemsEn: [
      'Proof of the availability and use of assistive educational technology/equipment.',
      'Records related to the attendance and deployment of special educators.',
    ],
  },
  {
    code: '5.1.2',
    itemsHi: [
      'गतिविधियों के प्रतिभागिता अभिलेख।',
      'यू-डाइस प्लस (UDISE+) प्रविष्टि।',
      'फोटो प्रमाण।',
    ],
    itemsEn: [
      'Participation records of activities.',
      'UDISE+ entry.',
      'Photographic evidence.',
    ],
  },
  {
    code: '5.1.3',
    itemsHi: [
      'गतिविधि-वार प्रतिभागिता अभिलेख।',
      'फोटो प्रमाण।',
      'नेतृत्व/भूमिका अभिलेख।',
    ],
    itemsEn: [
      'Activity-wise participation records.',
      'Photographic evidence.',
      'Leadership/role records.',
    ],
  },
  {
    code: '5.1.4',
    itemsHi: [
      'विभिन्न प्रतियोगिताओं/गतिविधियों का विवरण।',
      'मेंटरशिप कार्यक्रम एवं नवाचार गतिविधियों का विवरण।',
    ],
    itemsEn: [
      'Details of various competitions/activities.',
      'Details of mentorship programmes and innovation activities.',
    ],
  },
  {
    code: '5.2.1',
    itemsHi: [
      'पीटीएम रजिस्टर।',
      'पीटीएम के फोटो।',
    ],
    itemsEn: [
      'PTM register.',
      'Photos of the PTM.',
    ],
  },
  {
    code: '5.2.2',
    itemsHi: [
      'एसएमसी गठन आदेश।',
      'एसएमसी सदस्य सूची।',
      'प्रत्येक बैठक का एजेंडा और कार्यवृत्त।',
    ],
    itemsEn: [
      'SMC formation order.',
      'List of SMC members.',
      'Agenda and minutes of each meeting.',
    ],
  },
  {
    code: '5.2.3',
    itemsHi: [
      'शिकायत निवारण समिति गठन आदेश और सदस्यों की सूची।',
      'शिकायत पेटी का फोटो।',
    ],
    itemsEn: [
      'Grievance redressal committee formation order and list of members.',
      'Photo of the complaint box.',
    ],
  },
  {
    code: '5.2.4',
    itemsHi: [
      'बाह्य संस्थाओं (CSR/NGO) द्वारा उपलब्ध कराये गए सहयोग की फोटो व समन्वय हेतु किए गए पत्राचार के अभिलेख।',
    ],
    itemsEn: [
      'Photos of support provided by external organizations (CSR/NGO) and records of correspondence for coordination.',
    ],
  },
  {
    code: '5.2.5',
    itemsHi: [
      'सांस्कृतिक कार्यक्रमों/उत्सवों के अभिलेख एवं फोटो।',
      'विद्यालय-समुदाय संयुक्त गतिविधियों का दस्तावेज़ीकरण।',
    ],
    itemsEn: [
      'Records and photos of cultural programmes/celebrations.',
      'Documentation of joint school-community activities.',
    ],
  },
  {
    code: '5.2.6',
    itemsHi: [
      'ड्रॉपआउट जोखिम वाले विद्यार्थियों की सूची एवं प्रगति अभिलेख।',
      'अभिभावक/समुदाय संपर्क के रिकॉर्ड।',
      'डिजिटल रजिस्टर/पोर्टल के स्क्रीनशॉट।',
    ],
    itemsEn: [
      'List and progress records of students at risk of dropping out.',
      'Records of contact with parents/community.',
      'Screenshots of digital register/portal.',
    ],
  },
];
