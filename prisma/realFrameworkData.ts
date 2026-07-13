// Transcribed from: State Council of Educational Research & Training (SCERT), Uttar Pradesh.
// Document: "SQAAF Checklist" (8 June 2026 version, pages 22-54 of a 54-page document).
// Hindi text (titleHi / labelHi) is copied verbatim from the source. English text (titleEn / labelEn)
// is a faithful literal translation produced for this seed file and is not itself an official
// government translation.

export type OptionSeed = {
  key: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
  labelEn: string;
  labelHi: string;
  order: number;
  score: number;
};

export type Applicability = 'PRIMARY' | 'UPPER_PRIMARY' | 'SECONDARY';

export type ParameterSeed = {
  code: string; // e.g. "1.1.1" - use the document's own numbering
  titleEn: string; // natural English translation of the parameter name
  titleHi: string; // the Hindi parameter name only (not the full level text)
  order: number; // sequential order within its sub-domain, starting at 1
  applicability: Applicability[]; // subset of ['PRIMARY','UPPER_PRIMARY','SECONDARY']; all three if unrestricted
  evidenceRequired: boolean; // true for every parameter (every one has an evidence list in the source)
  options: OptionSeed[]; // exactly 3 entries: LEVEL_1 (score 1), LEVEL_2 (score 2), LEVEL_3 (score 3), in that order
};

export type SubDomainSeed = {
  code: string;
  titleEn: string;
  titleHi: string;
  order: number;
  parameters: ParameterSeed[];
};

export type DomainSeed = {
  code: string;
  titleEn: string;
  titleHi: string;
  order: number;
  weightPercent: number;
  subDomains: SubDomainSeed[];
};

const ALL_BANDS: Applicability[] = ['PRIMARY', 'UPPER_PRIMARY', 'SECONDARY'];

// Internal builder helpers (not exported) - reduce repetition while keeping the exported
// REAL_FRAMEWORK_DATA constant fully typed as DomainSeed[].
function mkParam(
  code: string,
  titleEn: string,
  titleHi: string,
  order: number,
  applicability: Applicability[],
  l1Hi: string,
  l1En: string,
  l2Hi: string,
  l2En: string,
  l3Hi: string,
  l3En: string
): ParameterSeed {
  return {
    code,
    titleEn,
    titleHi,
    order,
    applicability,
    evidenceRequired: true,
    options: [
      { key: 'LEVEL_1', labelEn: l1En, labelHi: l1Hi, order: 1, score: 1 },
      { key: 'LEVEL_2', labelEn: l2En, labelHi: l2Hi, order: 2, score: 2 },
      { key: 'LEVEL_3', labelEn: l3En, labelHi: l3Hi, order: 3, score: 3 },
    ],
  };
}

function mkSub(code: string, titleEn: string, titleHi: string, order: number, parameters: ParameterSeed[]): SubDomainSeed {
  return { code, titleEn, titleHi, order, parameters };
}

function mkDomain(
  code: string,
  titleEn: string,
  titleHi: string,
  order: number,
  weightPercent: number,
  subDomains: SubDomainSeed[]
): DomainSeed {
  return { code, titleEn, titleHi, order, weightPercent, subDomains };
}

// NOTE on weightPercent: the source pages provided do not specify inter-dimension (आयाम) weights,
// so all 5 domains are given an equal placeholder weight of 20%. This must be revisited once the
// real SQAAF weighting scheme is known.
export const REAL_FRAMEWORK_DATA: DomainSeed[] = [
  mkDomain('D1', 'Infrastructure and Safety', 'अवसंरचना एवं सुरक्षा', 1, 20, [
    mkSub('D1_1.1', 'Physical Infrastructure', 'भौतिक ढांचा', 1, [
      mkParam(
        '1.1.1',
        'Availability of classrooms',
        'कक्षा कक्ष की उपलब्धता',
        1,
        ALL_BANDS,
        `प्रत्येक कक्षा के लिए अलग-अलग कमरे की उपलब्धता नहीं है।`,
        `Separate rooms are not available for each class.`,
        `प्रत्येक कक्षा के लिए अलग-अलग कमरे की उपलब्धता है, लेकिन उनका समुचित उपयोग नहीं हो रहा है।`,
        `Separate rooms are available for each class, but they are not being used properly.`,
        `सभी कक्षाएं अलग-अलग कमरों में संचालित हो रही हैं, एवं प्रत्येक कक्षा एवं सेक्शन हेतु कक्षा कक्ष उपलब्ध है एवं प्रयोग में है, जिसमें अधिकतम 45 विद्यार्थी बैठते हैं।`,
        `All classes are conducted in separate rooms, and a classroom is available and in use for every class and section, seating a maximum of 45 students.`
      ),
      mkParam(
        '1.1.2',
        'Adequate space and proper seating arrangement in the classroom',
        'कक्षा में पर्याप्त जगह एवं समुचित बैठक व्यवस्था',
        2,
        ALL_BANDS,
        `प्रत्येक विद्यार्थी के बैठने हेतु फर्नीचर उपलब्ध नहीं है। यदि उपलब्धता है तो फर्नीचर टूटी-फूटी है। बेंचों के बीच शिक्षक जा नहीं सकते।`,
        `Furniture for every student to sit on is not available. Where it is available, it is broken. Teachers cannot move between the benches.`,
        `प्रत्येक बच्चे की अपनी सीट है। फर्नीचर ठीक हालत में है। शिक्षक प्रत्येक बच्चे तक पहुंच सकते हैं। प्रत्येक बच्चे के लिए कम से कम 9 वर्ग फुट जगह उपलब्ध है।`,
        `Every child has their own seat. Furniture is in good condition. Teachers can reach every child. At least 9 square feet of space is available per child.`,
        `प्रत्येक बच्चे की अपनी सीट है। फर्नीचर ठीक हालत में है। शिक्षक प्रत्येक बच्चे तक पहुंच सकते हैं। प्रत्येक बच्चे के लिए कम से कम 9 वर्ग फुट जगह उपलब्ध है। ग्रुप वर्क या गतिविधियों के लिए सेटअप बदलना आसान है।`,
        `Every child has their own seat. Furniture is in good condition. Teachers can reach every child. At least 9 square feet of space is available per child. The setup can easily be rearranged for group work or activities.`
      ),
      mkParam(
        '1.1.3',
        'Ventilation in the classroom',
        'कक्षा में वेन्टिलेसन',
        3,
        ALL_BANDS,
        `वेन्टिलेसन हेतु केवल खिड़कियां/रोशनदान ही उपलब्ध हैं। सभी कक्षा-कक्षों में क्रियाशील पंखे की उपलब्धता नहीं है।`,
        `Only windows/ventilators are available for ventilation. Not all classrooms have working fans.`,
        `वेन्टिलेसन हेतु खिड़कियां/रोशनदान के साथ-साथ प्रत्येक कक्षा में कम से कम एक क्रियाशील पंखा उपलब्ध है।`,
        `In addition to windows/ventilators, at least one working fan is available in every classroom.`,
        `वेन्टिलेसन हेतु खिड़कियां/रोशनदान के साथ-साथ प्रत्येक कक्षा में कम से कम 2 पंखे (प्राथमिक) 3 पंखे (उच्च प्राथमिक) 4 पंखे (माध्यमिक) उपलब्ध हैं, या कक्षाएँ वातानुकूलित हैं।`,
        `In addition to windows/ventilators, every classroom has at least 2 fans (primary), 3 fans (upper primary), or 4 fans (secondary), or the classrooms are air-conditioned.`
      ),
      mkParam(
        '1.1.4',
        'Availability of lighting in the classroom',
        'कक्षा में प्रकाश की उपलब्धता',
        4,
        ALL_BANDS,
        `प्रत्येक कक्षा में पर्याप्त प्राकृतिक प्रकाश है, परंतु एलईडी बल्ब आदि की व्यवस्था नही है।`,
        `Every classroom has adequate natural light, but there is no arrangement for LED bulbs etc.`,
        `प्रत्येक कक्षा में पर्याप्त प्राकृतिक प्रकाश है, न्यूनतम 2 एलईडी बल्ब/ट्यूबलाइट है।`,
        `Every classroom has adequate natural light and a minimum of 2 LED bulbs/tube lights.`,
        `प्रत्येक कक्षा में पर्याप्त प्राकृतिक प्रकाश है, न्यूनतम 4 एलईडी बल्ब/ट्यूबलाइट है।`,
        `Every classroom has adequate natural light and a minimum of 4 LED bulbs/tube lights.`
      ),
      mkParam(
        '1.1.5',
        'Availability of principal/head-teacher room, staff room and store room',
        'प्रधानाचार्य/प्रधानाध्यापक कक्ष/ स्टाफ कक्ष/ स्टोर रूम की उपलब्धता',
        5,
        ALL_BANDS,
        `प्रधानाचार्य/प्रधानाध्यापक कक्ष/ स्टाफ कक्ष/ स्टोर रूम हेतु मात्र एक ही कमरा उपलब्ध है।`,
        `Only a single room is available to serve as the principal/head-teacher room, staff room and store room.`,
        `प्रधानाचार्य/प्रधानाध्यापक कक्ष/ स्टाफ कक्ष/ स्टोर रूम हेतु कम से कम दो कमरे उपलब्ध हैं और प्रयोग में हैं।`,
        `At least two rooms are available and in use for the principal/head-teacher room, staff room and store room.`,
        `प्रधानाचार्य/ प्रधानाध्यापक कक्ष/ स्टाफ कक्ष/ स्टोर रूम हेतु पृथक-पृथक कमरे उपलब्ध हैं तथा सुव्यवस्थित हैं।`,
        `Separate, well-organized rooms are available for the principal/head-teacher room, staff room and store room.`
      ),
      mkParam(
        '1.1.6',
        'Availability of safe drinking water',
        'शुद्ध पेयजल की उपलब्धता',
        6,
        ALL_BANDS,
        `शुद्ध पेय जल उपलब्ध है किन्तु जल स्रोत के आस-पास साफ-सफाई का अभाव है।`,
        `Safe drinking water is available, but the area around the water source is not clean.`,
        `सभी विद्यार्थियों हेतु शुद्ध पेयजल उपलब्ध है और जल स्रोत के आसपास नियमित साफ-सफाई सुनिश्चित की जाती है।`,
        `Safe drinking water is available for all students, and the area around the water source is kept regularly clean.`,
        `कई फ़िल्टर्ड जल स्टेशन/RO उपलब्ध हैं जो सभी बच्चों एवं स्टाफ के लिये पर्याप्त हैं। कम से कम 3-6 महीने में एक बार इसकी जाँच की जाती है।`,
        `Multiple filtered water stations/ROs are available, sufficient for all children and staff. Water quality is tested at least once every 3-6 months.`
      ),
      mkParam(
        '1.1.7',
        'Condition of toilets and regular cleanliness arrangements',
        'शौचालय की स्थिति एवं नियमित स्वच्छता व्यवस्था',
        7,
        ALL_BANDS,
        `बालक-बालिकाओं के लिए पृथक शौचालय उपलब्ध हैं, किंतु पर्याप्त संख्या में नहीं हैं। शौचालय स्वच्छ नहीं हैं। इसके अतिरिक्त, शौचालयों में निरंतर जल आपूर्ति (रनिंग वाटर) की व्यवस्था भी नहीं है।`,
        `Separate toilets are available for boys and girls, but not in sufficient number. The toilets are not clean. In addition, there is no continuous (running) water supply in the toilets.`,
        `विद्यालय में बालक, बालिका एवं दिव्यांग विद्यार्थियों हेतु रनिंग वाटर युक्त पृथक शौचालय उपलब्ध हैं। शौचालय स्वच्छ हैं। साप्ताहिक सफाई सुनिश्चित की जाती है।`,
        `The school has separate toilets with running water for boys, girls and children with disabilities. The toilets are clean, and weekly cleaning is ensured.`,
        `बालक, बालिका, दिव्यांग और स्टाफ के लिए अलग-अलग स्वच्छ शौचालय, साबुन व रनिंग वाटर की सुविधा के साथ उपलब्ध है। प्रत्येक 40 बच्चों पर एक टॉयलेट यूनिट (1 टायलेट/वाटर क्लोजेट, 3-यूरिनल) उपलब्ध हैं, जिनकी प्रतिदिन सफाई सुनिश्चित की जाती है। बालिका शौचालय से लगा हुआ क्रियाशील इनसीनरेटर स्थापित है।`,
        `Separate, clean toilets with soap and running water are available for boys, girls, children with disabilities and staff. There is one toilet unit (1 toilet/water closet, 3 urinals) per 40 children, cleaned daily. A working incinerator is installed adjoining the girls' toilet.`
      ),
      mkParam(
        '1.1.8',
        'Handwashing facility',
        'हाथ धोने की सुविधा',
        8,
        ALL_BANDS,
        `हैंडवाश यूनिट नहीं है। यदि है तो बहुत ही कम संख्या में है या क्रियाशील नहीं है।`,
        `There is no handwashing unit. Where present, the units are very few in number or not functional.`,
        `हैंडवाश यूनिट उपलब्ध है एवं क्रियाशील है।`,
        `A handwashing unit is available and functional.`,
        `प्रत्येक 12 बच्चों पर कम से कम एक क्रियाशील हैंडवाश यूनिट उपलब्ध है।`,
        `At least one functional handwashing unit is available for every 12 children.`
      ),
      mkParam(
        '1.1.9',
        'Indoor/outdoor sports infrastructure',
        'इनडोर/आउटडोर खेल अवसंरचना',
        9,
        ALL_BANDS,
        `विद्यालय में खेल के मैदान का अभाव है अथवा वह असुरक्षित है। साथ ही, इन्डोर खेलों के लिए भी कोई उपयुक्त स्थान या सुविधा उपलब्ध नहीं है।`,
        `The school lacks a playground, or the playground is unsafe. In addition, no suitable space or facility is available for indoor games either.`,
        `प्राथमिक व उच्च प्राथमिक के लिए कम से कम 1200 वर्ग मीटर तथा माध्यमिक के लिए कम से कम 1500 वर्ग मीटर का खेल का मैदान उपलब्ध है जहाँ नियमित खेल होते हैं। विभिन्न खेलों के लिए डेडिकेटेड स्पोर्ट्स इन्फ्रास्ट्रक्चर उपलब्ध है।`,
        `A playground of at least 1200 square metres for primary and upper primary, and at least 1500 square metres for secondary, is available and regularly used for games. Dedicated sports infrastructure is available for different games.`,
        `प्राथमिक व उच्च प्राथमिक के लिए कम से कम 2400 वर्ग मीटर तथा माध्यमिक के लिए कम से कम 3000 वर्ग मीटर का खेल का अच्छा मैदान उपलब्ध है (लेकिन प्रति विद्यार्थी 5 वर्ग मीटर से कम नहीं) जहाँ नियमित खेल होते हैं। विभिन्न खेलों के लिए डेडिकेटेड स्पोर्ट्स इन्फ्रास्ट्रक्चर के साथ खेल शिक्षक भी हैं।`,
        `A good playground of at least 2400 square metres for primary and upper primary, and at least 3000 square metres for secondary (but not less than 5 square metres per student), is available and regularly used for games. There is dedicated sports infrastructure for different games, along with a sports teacher.`
      ),
      mkParam(
        '1.1.10',
        'Space for assembly and events',
        'सभा और कार्यक्रमों हेतु स्थान',
        10,
        ALL_BANDS,
        `सभा और कार्यक्रमों हेतु कोई निर्धारित स्थान उपलब्ध नहीं है; अतः सभा का आयोजन खुले मैदान या कक्षाओं में किया जाता है।`,
        `No designated space is available for assemblies and events; assemblies are therefore held in the open field or in classrooms.`,
        `सभाओं और कार्यक्रमों हेतु बहुउद्देश्यीय हॉल की सुविधा उपलब्ध है, जहाँ पर्याप्त बैठने की जगह और बुनियादी ऑडियो सिस्टम स्थापित है।`,
        `A multipurpose hall is available for assemblies and events, with adequate seating space and a basic audio system installed.`,
        `विद्यालय में सभाओं और कार्यक्रमों हेतु एक बहुउद्देश्यीय हॉल उपलब्ध है, जो समुचित बैठक व्यवस्था, मंच, आधुनिक ध्वनि एवं प्रकाश प्रणाली से सुसज्जित है। इसमें पर्याप्त पंखे लगे हैं जो क्रियाशील हैं या पूरा हॉल वातानुकूलित है।`,
        `The school has a multipurpose hall for assemblies and events, equipped with proper seating, a stage, and a modern sound and lighting system. It has sufficient working fans, or the entire hall is air-conditioned.`
      ),
      mkParam(
        '1.1.11',
        'Availability of a library',
        'पुस्तकालय की उपलब्धता',
        11,
        ALL_BANDS,
        `विद्यालय में पुस्तकालय अथवा रीडिंग कॉर्नर का अभाव है। पुस्तकों की उपलब्धता नगण्य है या उन तक विद्यार्थियों की पहुंच अत्यंत सीमित है।`,
        `The school lacks a library or reading corner. Books are negligible in number, or students' access to them is extremely limited.`,
        `विद्यालय में पुस्तकालय अथवा कक्षाओं में रीडिंग कॉर्नर उपलब्ध है, जहाँ आयु-अनुकूल पुस्तकों का पर्याप्त संग्रह है। विद्यार्थियों को साप्ताहिक आधार पर पुस्तकें उपलब्ध कराई जाती हैं। समय सारणी में पुस्तकालय का वादन है।`,
        `The school has a library or a reading corner in classrooms with an adequate collection of age-appropriate books. Books are provided to students on a weekly basis. A library period is included in the timetable.`,
        `पर्याप्त आयु-अनुकूल पुस्तकों और समाचार पत्रों से युक्त सक्रिय पुस्तकालय उपलब्ध है। पुस्तकालय के नियमित संचालन के साथ-साथ रिकॉर्ड हेतु इश्यू रजिस्टर को अद्यतन रखा जाता है और नई पठन सामग्री निरंतर जोड़ी जाती है। समय सारणी के अनुसार पुस्तकालय का नियमित उपयोग होता है।`,
        `An active library is available with an adequate collection of age-appropriate books and newspapers. Along with regular operation of the library, the issue register is kept updated for record-keeping, and new reading material is continuously added. The library is used regularly as per the timetable.`
      ),
      mkParam(
        '1.1.12',
        'Science and Mathematics laboratory',
        'विज्ञान और गणित विषय की प्रयोगशाला',
        12,
        ALL_BANDS,
        `कक्षा 9 से 12 हेतु - विज्ञान व गणित विषय की प्रयोगशाला नहीं है, यदि है तो उपकरण टूटे, पुराने या कम हैं। कक्षा 6 से 8 हेतु - विज्ञान एवं गणित शिक्षण हेतु सहायक सामग्री उपलब्ध है किन्तु विज्ञान एवं गणित किट उपलब्ध नहीं है।`,
        `For classes 9 to 12 - there is no Science and Mathematics laboratory; where one exists, the equipment is broken, old or insufficient. For classes 6 to 8 - supplementary material for teaching Science and Mathematics is available, but Science and Mathematics kits are not available.`,
        `कक्षा 9 से 12 हेतु - सुव्यवस्थित उपकरणों के साथ विज्ञान एवं गणित लैब क्रियाशील है। वर्तमान में प्रयोगात्मक सत्र आयोजित होते हैं, परंतु वे नियमित अंतराल पर नहीं हैं। कक्षा 6 से 8 हेतु - विज्ञान एवं गणित किट उपलब्ध है एवं उसका नियमित प्रयोग होता है।`,
        `For classes 9 to 12 - a Science and Mathematics lab with well-organized equipment is functional. Practical sessions are currently held, but not at regular intervals. For classes 6 to 8 - Science and Mathematics kits are available and used regularly.`,
        `कक्षा 9 से 12 हेतु - आवश्यक उपकरण युक्त कम से कम 440 वर्गफुट की गणित और विज्ञान लैब उपलब्ध है, जहाँ प्रत्येक विषय का समय सारणी अनुसार प्रति सप्ताह कम से कम एक लैब पीरियड होता है। कक्षा 6 से 8 हेतु - विज्ञान एवं गणित किट उपलब्ध है एवं उसका नियमित प्रयोग होता है। बच्चों को लर्निंग बाइ डूइंग गतिविधियों में नियमित प्रतिभाग करने का अवसर प्राप्त होता है।`,
        `For classes 9 to 12 - a Mathematics and Science lab of at least 440 square feet with the necessary equipment is available, with at least one lab period per week per subject as per the timetable. For classes 6 to 8 - Science and Mathematics kits are available and used regularly. Children get the opportunity to regularly participate in learning-by-doing activities.`
      ),
      mkParam(
        '1.1.13',
        'Computer/ICT lab',
        'कंप्यूटर/ICT लैब',
        13,
        ALL_BANDS,
        `कक्षा 9 से 12 हेतु - ICT लैब उपलब्ध नहीं है या क्रियाशील नहीं है। विद्यालय में न्यूनतम 5 कंप्यूटर हैं, पर शिक्षण-अधिगम में उनका नियमित उपयोग नहीं होता है। कक्षा 6 से 8 हेतु - ICT लैब उपलब्ध नहीं है या क्रियाशील नहीं है।`,
        `For classes 9 to 12 - the ICT lab is not available or not functional. The school has a minimum of 5 computers, but they are not used regularly for teaching-learning. For classes 6 to 8 - the ICT lab is not available or not functional.`,
        `कक्षा 9 से 12 हेतु - ICT लैब क्रियाशील है। कम से कम 10 कंप्यूटर उपलब्ध हैं। सप्ताह में लैब का नियमित उपयोग होता है। कक्षा 6 से 8 हेतु - ICT लैब क्रियाशील है। कम से कम 2 कंप्यूटर उपलब्ध हैं। सप्ताह में लैब का नियमित उपयोग होता है।`,
        `For classes 9 to 12 - the ICT lab is functional. At least 10 computers are available. The lab is used regularly during the week. For classes 6 to 8 - the ICT lab is functional. At least 2 computers are available. The lab is used regularly during the week.`,
        `कक्षा 9 से 12 हेतु - न्यूनतम 25 इंटरनेट युक्त क्रियाशील कंप्यूटर उपलब्ध हैं जहाँ कम से कम 25:1 आदर्श विद्यार्थी कंप्यूटर अनुपात सुनिश्चित किया गया है। कक्षा 6 से 8 हेतु - न्यूनतम 6 क्रियाशील कंप्यूटर उपलब्ध हैं। समय सारिणी के अनुसार नियमित प्रयोग होता है।`,
        `For classes 9 to 12 - a minimum of 25 working, internet-enabled computers are available, ensuring an ideal student-to-computer ratio of at least 25:1. For classes 6 to 8 - a minimum of 6 working computers are available, used regularly as per the timetable.`
      ),
      mkParam(
        '1.1.14',
        'Smart class equipment',
        'स्मार्ट क्लास उपकरण',
        14,
        ALL_BANDS,
        `स्मार्ट क्लास उपलब्ध नहीं हैं। शिक्षक मोबाइल अथवा अन्य उपकरण से आवश्यक गतिविधियां संचालित करते हैं।`,
        `Smart classes are not available. Teachers conduct necessary activities using mobile phones or other devices.`,
        `विद्यालय में कम से कम एक स्मार्ट क्लास संचालित है जिसका नियमित रूप से उपयोग किया जाता है।`,
        `At least one smart class is operating in the school and is used regularly.`,
        `विद्यालय के प्रत्येक कक्षा में स्मार्ट क्लास संचालित है जिसका नियमित रूप से उपयोग किया जाता है।`,
        `A smart class is operating in every classroom of the school and is used regularly.`
      ),
      mkParam(
        '1.1.15',
        'Medical room and first aid',
        'मेडिकल रूम और फर्स्ट एड',
        15,
        ALL_BANDS,
        `मेडिकल रूम उपलब्ध नहीं है; फर्स्ट एड किट उपलब्ध नहीं है या क्रियाशील नहीं है, स्वास्थ्य जांच नियमित नहीं होती।`,
        `A medical room is not available; the first-aid kit is not available or not usable, and health check-ups are not conducted regularly.`,
        `मेडिकल रूम/निर्धारित स्थान उपलब्ध है; फर्स्ट एड किट क्रियाशील है और समय-समय पर स्वास्थ्य जांच की जाती है।`,
        `A medical room/designated space is available; the first-aid kit is usable, and health check-ups are conducted from time to time.`,
        `मेडिकल रूम उपलब्ध है; फर्स्ट एड किट क्रियाशील है, नियमित स्वास्थ्य जांच व आवश्यक उपचार होता है और सभी अभिलेख व्यवस्थित रखे जाते हैं।`,
        `A medical room is available; the first-aid kit is usable, regular health check-ups and necessary treatment are provided, and all records are kept in order.`
      ),
      mkParam(
        '1.1.16',
        'Menstrual hygiene and management',
        'मासिक धर्म स्वच्छता एवं प्रबंधन',
        16,
        ALL_BANDS,
        `मासिक धर्म स्वच्छता पर सीमित ध्यान है; सैनिटरी पैड की उपलब्धता तो है, पर जागरूकता और उपयोग से जुड़ी जानकारी का अभाव है।`,
        `Limited attention is given to menstrual hygiene; sanitary pads are available, but there is a lack of awareness and information related to their use.`,
        `मासिक धर्म स्वच्छता के लिए व्यवस्था है; सैनिटरी पैड नियमित रूप से उपलब्ध हैं, बालिकाओं को सीमित रूप में उपलब्ध कराए जाते हैं और जागरूकता सत्र आयोजित होते हैं।`,
        `Arrangements exist for menstrual hygiene; sanitary pads are regularly available, provided to girls in limited quantities, and awareness sessions are conducted.`,
        `मासिक धर्म स्वच्छता के लिए समुचित और संवेदनशील व्यवस्था है; सैनिटरी पैड की नियमित उपलब्धता व वितरण सुनिश्चित है, अभिलेख रखे जाते हैं, शिक्षक प्रशिक्षित होते हैं और सभी छात्रों के लिए नियमित जागरूकता सत्र आयोजित होते हैं।`,
        `A proper and sensitive arrangement exists for menstrual hygiene; regular availability and distribution of sanitary pads is ensured, records are maintained, teachers are trained, and regular awareness sessions are held for all students.`
      ),
      mkParam(
        '1.1.17',
        'Facilities for children with disabilities',
        'दिव्यांग बच्चों के लिए सुविधाएं',
        17,
        ALL_BANDS,
        `रैंप नहीं है या टूटा है। दिव्यांग बच्चों को कक्षा/शौचालय तक पहुंचने में असुविधा होती है।`,
        `There is no ramp, or it is broken. Children with disabilities face difficulty in accessing classrooms/toilets.`,
        `रैंप सही है और उपयोग करने की स्थिति में है। ग्राउंड फ्लोर पर कक्षा और शौचालय सुलभ हैं।`,
        `The ramp is in good, usable condition. Classrooms and toilets on the ground floor are accessible.`,
        `रैंप सभी आवश्यक स्थानों पर हैं। दिव्यांग शौचालय पृथक एवं क्रियाशील है। व्हीलचेयर आसानी से जा सकती है। हैंडरेल और टैक्टाइल पाथ लगे हैं।`,
        `Ramps are present at all necessary locations. A separate, functional toilet for children with disabilities is available. Wheelchairs can move around easily. Handrails and tactile paths are installed.`
      ),
      mkParam(
        '1.1.18',
        'Display of Child Helpline number and other emergency numbers',
        'चाइल्ड हेल्पलाइन नंबर और अन्य इमरजेंसी नंबरों का प्रदर्शन',
        18,
        ALL_BANDS,
        `हेल्पलाइन नंबर 1098 स्पष्ट रूप से प्रदर्शित नहीं है, या सिर्फ एक जगह लगे हैं जहाँ आसानी से दिखते नहीं।`,
        `Helpline number 1098 is not clearly displayed, or is displayed at only one place where it is not easily visible.`,
        `चाइल्ड हेल्पलाइन नंबर 1098 और अन्य इमरजेंसी नंबर कई जगहों पर प्रदर्शित हैं, जैसे गेट, नोटिस बोर्ड और कक्षाओं में। पर बच्चों को इसके बारे में पर्याप्त जानकारी नहीं है।`,
        `Child Helpline number 1098 and other emergency numbers are displayed at several places, such as the gate, notice board, and classrooms. But children do not have adequate information about it.`,
        `चाइल्ड हेल्पलाइन नंबर 1098 और अन्य इमरजेंसी नंबर बड़े अक्षरों में प्रमुखता से प्रदर्शित हैं। बच्चों को इन नंबरों की जानकारी है और वे जानते हैं कि इनका इस्तेमाल कब और कैसे करना है।`,
        `Child Helpline number 1098 and other emergency numbers are prominently displayed in large letters. Children know these numbers and know when and how to use them.`
      ),
      mkParam(
        '1.1.19',
        'Kitchen/canteen',
        'किचन/कैंटीन',
        19,
        ALL_BANDS,
        `किचन/कैंटीन उपलब्ध नहीं है। यदि है, तो स्वच्छता का अभाव है।`,
        `A kitchen/canteen is not available. Where one exists, it lacks cleanliness.`,
        `विद्यालय की रसोई/कैंटीन स्वच्छ व सुव्यवस्थित है, जहाँ नियमित गुणवत्ता जाँच के उपरांत पौष्टिक आहार विद्यार्थियों को प्रदान किया जाता है।`,
        `The school's kitchen/canteen is clean and well-organized, where nutritious food is provided to students after regular quality checks.`,
        `विद्यालय की रसोई एवं कैंटीन स्वच्छ व सुव्यवस्थित है, जहाँ गुणवत्ता जाँच के उपरांत पौष्टिक आहार विद्यार्थियों को प्रदान किया जाता है। साथ ही, विद्यार्थियों से प्राप्त नियमित फीडबैक लिया जाता है जिसके आधार पर निरंतर सुधार किया जाता है।`,
        `The school's kitchen and canteen are clean and well-organized, where nutritious food is provided to students after quality checks. In addition, regular feedback is taken from students, and continuous improvements are made based on it.`
      ),
      mkParam(
        '1.1.20',
        'Kitchen garden/green school',
        'किचन गार्डन/ हरित विद्यालय',
        20,
        ALL_BANDS,
        `किचन गार्डन नहीं है, विद्यालय में पेड़ पौधे बहुत कम हैं।`,
        `There is no kitchen garden; the school has very few trees and plants.`,
        `किचन गार्डन है, पेड़ पौधे पर्याप्त हैं, किन्तु देखभाल का अभाव है।`,
        `A kitchen garden exists, and there are adequate trees and plants, but they lack proper care.`,
        `किचन गार्डन है, पेड़ पौधे पर्याप्त हैं, नियमित देखभाल की जाती है। किचन गार्डन से पोषाहार हेतु सब्जियां प्राप्त होती हैं।`,
        `A kitchen garden exists, there are adequate trees and plants, and they are cared for regularly. Vegetables for the mid-day meal are obtained from the kitchen garden.`
      ),
      mkParam(
        '1.1.21',
        'Waste management',
        'कचरा प्रबंधन',
        21,
        ALL_BANDS,
        `कचरा प्रबंधन की व्यवस्था नहीं है। कूड़ेदान नहीं हैं, कहीं भी कचरा पड़ा रहता है।`,
        `There is no waste management system. There are no dustbins, and waste lies around anywhere.`,
        `सूखे तथा गीले कचरे के लिये नीले/हरे कूड़ेदान हैं। बच्चे नीले/हरे कूड़ेदान का प्रयोग करते हैं।`,
        `There are blue/green dustbins for dry and wet waste. Children use the blue/green dustbins.`,
        `नीले/हरे कूड़ेदान हैं। कम्पोस्ट पिट का इस्तेमाल होता है। बच्चों को कचरा प्रबंधन की जानकारी है। पोस्टर के माध्यम से तथा असेंबली में इसपर चर्चा होती है।`,
        `There are blue/green dustbins. A compost pit is used. Children are aware of waste management, and it is discussed through posters and in assembly.`
      ),
      mkParam(
        '1.1.22',
        'Electricity connection and supply',
        'विद्युत संयोजन एवं आपूर्तिकरण',
        22,
        ALL_BANDS,
        `विद्यालय में स्थायी विद्युत कनेक्शन उपलब्ध नहीं है या उपलब्ध होने पर भी क्रियाशील नहीं है।`,
        `The school does not have a permanent electricity connection, or if it does, it is not functional.`,
        `विद्यालय परिसर में सुरक्षित वायरिंग के साथ स्थायी विद्युत कनेक्शन उपलब्ध है और नियमित विद्युत आपूर्ति होती है।`,
        `The school premises have a permanent electricity connection with safe wiring, and there is a regular power supply.`,
        `विद्यालय परिसर में सुरक्षित वायरिंग एवं स्थायी विद्युत आपूर्ति के साथ वैकल्पिक विद्युत व्यवस्था (इन्वर्टर/जनरेटर आदि) भी उपलब्ध है।`,
        `In addition to safe wiring and a permanent electricity supply, the school premises also have a backup power arrangement (inverter/generator, etc.).`
      ),
    ]),
    mkSub('D1_1.2', 'Student Safety and Security', 'विद्यार्थियों की सुरक्षा और संरक्षा', 2, [
      mkParam(
        '1.2.1',
        'CCTV coverage and functionality',
        'CCTV कवरेज एवं क्रियाशीलता',
        1,
        ALL_BANDS,
        `CCTV नहीं लगा है या काम नहीं कर रहा। कुछ ही जगहों पर कवरेज है और रिकॉर्डिंग नियमित रूप से नहीं होती है।`,
        `CCTV is not installed or is not working. Coverage exists only in a few places, and recording is not done regularly.`,
        `मुख्य स्थानों (गेट, गलियारे, मैदान) पर CCTV है। 30+ दिनों की रिकॉर्डिंग उपलब्ध है।`,
        `CCTV is installed at key locations (gate, corridors, playground). 30+ days of recording is available.`,
        `कक्षा कक्ष सहित सम्पूर्ण परिसर में CCTV है। लाइव मॉनिटरिंग, नियमित जांच, घटनाओं की ट्रैकिंग एवं अलर्ट सिस्टम उपलब्ध है।`,
        `CCTV covers the entire premises, including classrooms. Live monitoring, regular checks, incident tracking, and an alert system are available.`
      ),
      mkParam(
        '1.2.2',
        'Security guard/watchman and premises security',
        'सुरक्षा गार्ड/चौकीदार एवं परिसर की सुरक्षा',
        2,
        ALL_BANDS,
        `सुरक्षा गार्ड/चौकीदार उपलब्ध नहीं हैं। निगरानी व्यवस्था नहीं है और कोई भी प्रवेश कर सकता है।`,
        `A security guard/watchman is not available. There is no monitoring system, and anyone can enter.`,
        `सभी गेट पर गार्ड/चौकीदार हैं। विजिटर रजिस्टर व आईडी की जांच की जाती है।`,
        `Guards/watchmen are present at all gates. Visitor registers and ID are checked.`,
        `सभी गेट पर गार्ड हैं। विजिटर रजिस्टर व आईडी जांच की जाती है। डिजिटल एंट्री सिस्टम है। सख्त नियमों का पालन होता है तथा अभिभावकों को रियल-टाइम अलर्ट मिलता है।`,
        `Guards are present at all gates. Visitor registers and ID are checked. There is a digital entry system. Strict rules are followed, and parents receive real-time alerts.`
      ),
      mkParam(
        '1.2.3',
        'Boundary wall and security',
        'चहारदीवारी और सुरक्षा',
        3,
        ALL_BANDS,
        `चहारदीवारी उपलब्ध नहीं है या क्षतिग्रस्त है; कई स्थानों से प्रवेश संभव है और परिसर सुरक्षित नहीं है।`,
        `There is no boundary wall, or it is damaged; entry is possible from many places, and the premises are not secure.`,
        `पूरी चहारदीवारी उपलब्ध है; प्रवेश एक निर्धारित गेट से नियंत्रित होता है और गेट पर ताला/चौकीदार की व्यवस्था है।`,
        `A complete boundary wall is present; entry is controlled through a designated gate, and there is a lock/watchman arrangement at the gate.`,
        `मजबूत और सुरक्षित चहारदीवारी है; प्रवेश पूर्णतः नियंत्रित है, गेट पर विज़िटर रजिस्टर रखा जाता है और सभी आगंतुकों की एंट्री दर्ज की जाती है।`,
        `There is a strong and secure boundary wall; entry is fully controlled, a visitor register is maintained at the gate, and the entry of all visitors is recorded.`
      ),
      mkParam(
        '1.2.4',
        'Fire safety',
        'आग से सुरक्षा',
        4,
        ALL_BANDS,
        `अग्निशमन उपकरण उपलब्ध नहीं हैं या अनुपयोगी हैं; अग्नि सुरक्षा की कोई स्पष्ट व्यवस्था या योजना नहीं है।`,
        `Firefighting equipment is not available or is unusable; there is no clear fire safety arrangement or plan.`,
        `सक्रिय अग्निशमन उपकरण उपलब्ध हैं; स्टाफ को प्रशिक्षण दिया गया है, वर्ष में कम से कम एक बार मॉक ड्रिल होती है और आवश्यक साइनेज प्रदर्शित हैं।`,
        `Working firefighting equipment is available; staff have been trained, a mock drill is held at least once a year, and necessary signage is displayed.`,
        `सक्रिय अग्निशमन उपकरण उपलब्ध हैं; नियमित थर्ड-पार्टी जांच होती है, स्टाफ व विद्यार्थी प्रशिक्षित हैं, वर्ष में कम से कम दो बार मॉक ड्रिल होती है, साइनेज स्पष्ट हैं और आपात निकासी की व्यवस्था उपलब्ध है।`,
        `Working firefighting equipment is available; regular third-party inspections take place, staff and students are trained, mock drills are held at least twice a year, signage is clear, and emergency evacuation arrangements are in place.`
      ),
      mkParam(
        '1.2.5',
        'Disaster management and drills',
        'आपदा प्रबंधन एवं ड्रिल',
        5,
        ALL_BANDS,
        `कोई आपदा प्रबंधन योजना नहीं है। मॉक ड्रिल नहीं होती और स्टाफ को भूमिका की जानकारी नहीं है।`,
        `There is no disaster management plan. Mock drills are not held, and staff are unaware of their roles.`,
        `वर्ष में कम से कम एक बार मॉक ड्रिल होती है। स्टाफ को अपनी भूमिका की पूरी जानकारी है। निकासी मार्ग साफ तौर पर चिह्नित हैं और पूरे परिसर में लगे नक्शों पर दिखाए गए हैं।`,
        `A mock drill is held at least once a year. Staff are fully aware of their roles. Evacuation routes are clearly marked and shown on maps displayed throughout the premises.`,
        `वर्ष में कम से कम दो बार मॉक ड्रिल होती है। स्टूडेंट ब्रिगेड सक्रिय हैं। वार्षिक सेफ्टी ऑडिट होता है। निकासी मार्ग साफ तौर पर चिह्नित हैं और पूरे परिसर में लगे नक्शों पर दिखाए गए हैं।`,
        `Mock drills are held at least twice a year. Student safety brigades are active. An annual safety audit is conducted. Evacuation routes are clearly marked and shown on maps displayed throughout the premises.`
      ),
      mkParam(
        '1.2.6',
        'Child protection and safety arrangements (POCSO)',
        'बाल संरक्षण एवं सुरक्षा व्यवस्था (POCSO)',
        6,
        ALL_BANDS,
        `बाल संरक्षण समिति उपलब्ध नहीं है या निष्क्रिय है; स्टाफ और विद्यार्थियों में बाल सुरक्षा/हेल्पलाइन की जानकारी का अभाव है।`,
        `A child protection committee is not available or is inactive; staff and students lack awareness of child safety/helpline information.`,
        `बाल संरक्षण समिति सक्रिय है; शिकायत की व्यवस्था उपलब्ध है और स्टाफ व विद्यार्थियों को समय-समय पर जागरूक किया जाता है।`,
        `The child protection committee is active; a complaint mechanism is available, and staff and students are made aware from time to time.`,
        `बाल संरक्षण समिति सक्रिय और प्रभावी है; गुमनाम शिकायत की सुविधा उपलब्ध है, बाल सुरक्षा जागरूकता नियमित गतिविधियों (जैसे प्रातःकालीन सभा) में सम्मिलित है, वार्षिक सुरक्षा ऑडिट होता है और विद्यार्थी भी बाल सुरक्षा के प्रति सजग हैं।`,
        `The child protection committee is active and effective; an anonymous complaint facility is available, child safety awareness is included in regular activities (such as the morning assembly), an annual safety audit is conducted, and students are also alert to child safety.`
      ),
    ]),
  ]),

  mkDomain('D2', 'Administration, Human Resource and Leadership', 'प्रशासन, मानव संसाधन और नेतृत्व', 2, 20, [
    mkSub('D2_2.1', 'Adequacy of Staff', 'स्टाफ की पर्याप्तता', 1, [
      mkParam(
        '2.1.1',
        'Student-Teacher Ratio Compliance (PTR Compliance)',
        'विद्यार्थी शिक्षक अनुपात की स्थिति (PTR अनुपालन)',
        1,
        ALL_BANDS,
        `विद्यार्थी-शिक्षक अनुपात निर्धारित मानकों के अनुरूप नहीं है। कई कक्षाओं को एक साथ एक शिक्षक के द्वारा शिक्षण कार्य किया जाता है।`,
        `The student-teacher ratio does not conform to the prescribed norms. Several classes are taught together by a single teacher.`,
        `विद्यार्थी-शिक्षक अनुपात निर्धारित मानकों के अनुरूप है।`,
        `The student-teacher ratio conforms to the prescribed norms.`,
        `विद्यार्थी-शिक्षक अनुपात निर्धारित मानकों से अधिक है। ज़रूरत पड़ने पर अतिरिक्त शिक्षक उपलब्ध हैं।`,
        `The student-teacher ratio is better than the prescribed norms. Additional teachers are available when needed.`
      ),
      mkParam(
        '2.1.2',
        'Subject-wise Qualified Teachers (for Language, Math/Science, Social Studies)',
        'विषयवार अर्ह शिक्षक (भाषा, गणित/विज्ञान, सामाजिक विषय हेतु)',
        2,
        ['UPPER_PRIMARY', 'SECONDARY'],
        `विद्यालय में केवल 50% से कम विषयों में अर्ह शिक्षक उपलब्ध हैं।`,
        `Qualified teachers are available for fewer than 50% of subjects in the school.`,
        `विद्यालय में 50% से 80% विषयों में अर्ह शिक्षक उपलब्ध हैं।`,
        `Qualified teachers are available for 50% to 80% of subjects in the school.`,
        `विद्यालय में 80% से अधिक विषयों में अर्ह शिक्षक उपलब्ध हैं।`,
        `Qualified teachers are available for more than 80% of subjects in the school.`
      ),
      mkParam(
        '2.1.3',
        'Availability of non-teaching staff',
        'गैर-शैक्षणिक स्टाफ की उपलब्धता',
        3,
        ['SECONDARY'],
        `विद्यालय में स्वीकृत पदों के सापेक्ष 50% से कम पदों पर ही नियुक्तियाँ की गई है। उक्त पदों पर नियुक्त कर्मचारी कार्यरत हैं।`,
        `Fewer than 50% of the sanctioned posts in the school have been filled. Staff appointed to those posts are working.`,
        `विद्यालय में स्वीकृत पदों के सापेक्ष 50% से 80% पदों पर नियुक्तियाँ की गई हैं। चपरासी, सफाईकर्मी एवं प्रशासनिक सहित सभी सहायक पद कार्यरत हैं।`,
        `50% to 80% of the sanctioned posts in the school have been filled. All support posts, including peon, sweeper and administrative staff, are functioning.`,
        `विद्यालय में स्वीकृत पदों के सापेक्ष 80% से अधिक पदों पर नियुक्तियाँ हैं, पूरी सपोर्ट टीम उपलब्ध है।`,
        `More than 80% of the sanctioned posts in the school have been filled; a full support team is available.`
      ),
      mkParam(
        '2.1.4',
        'Availability of non-teaching staff',
        'गैर-शैक्षणिक स्टाफ की उपलब्धता',
        4,
        ['PRIMARY', 'UPPER_PRIMARY'],
        `विद्यालय में चौकीदार और सफाईकर्मी की कोई व्यवस्था नहीं है। प्रधानाध्यापक द्वारा वैकल्पिक व्यवस्था की जाती है।`,
        `There is no arrangement for a watchman and sweeper in the school. The head teacher makes alternative arrangements.`,
        `विद्यालय में चौकीदार और सफाईकर्मी (सप्ताह में 2 या 3 दिन) की व्यवस्था है।`,
        `The school has a watchman and sweeper arrangement (2 or 3 days a week).`,
        `विद्यालय में चौकीदार और सफाईकर्मी प्रतिदिन उपलब्ध एवं कार्यरत हैं।`,
        `A watchman and sweeper are available and working every day in the school.`
      ),
      mkParam(
        '2.1.5',
        'Counsellor/well-being staff',
        'काउंसलर/वेलबीइंग स्टाफ',
        5,
        ['SECONDARY'],
        `विद्यालय में काउंसलर नहीं है। शिक्षक ही काउंसलिंग का काम करते हैं। मानसिक स्वास्थ्य के लिए कोई व्यवस्था नहीं है।`,
        `There is no counsellor in the school. Teachers themselves handle counselling. There is no arrangement for mental health.`,
        `विद्यालय में काउंसलर अंशकालिक (साप्ताहिक/पाक्षिक) रूप से उपलब्ध है। बच्चे ज़रूरत के हिसाब से मानसिक स्वास्थ्य और व्यक्तिगत परामर्श ले सकते हैं।`,
        `A counsellor is available on a part-time basis (weekly/fortnightly) in the school. Children can seek mental health and personal counselling as needed.`,
        `विद्यालय में पूर्णकालिक काउंसलर नियुक्त है। व्यवस्थित वेलबीइंग कार्यक्रम चलता है। नियमित SEL (social emotional learning) के सत्र होते हैं।`,
        `A full-time counsellor is appointed in the school. A structured well-being programme is run. Regular SEL (social-emotional learning) sessions are held.`
      ),
      mkParam(
        '2.1.6',
        'Monthly/quarterly attendance and continuity of non-teaching staff',
        'गैर-शैक्षणिक कर्मचारियों की मासिक/त्रैमासिक उपस्थिति और निरन्तरता',
        6,
        ALL_BANDS,
        `गैर-शैक्षणिक कर्मचारियों की उपस्थिति 75% से कम है। निरीक्षण की कोई व्यवस्था नहीं है।`,
        `Attendance of non-teaching staff is less than 75%. There is no inspection mechanism.`,
        `गैर-शैक्षणिक कर्मचारियों की उपस्थिति 75% से 90% के बीच है। मासिक निरीक्षण होता है।`,
        `Attendance of non-teaching staff is between 75% and 90%. Monthly inspections take place.`,
        `गैर-शैक्षणिक कर्मचारियों की उपस्थिति 90% से अधिक है। नियमित रूप से निरीक्षण होता है।`,
        `Attendance of non-teaching staff is more than 90%. Regular inspections take place.`
      ),
      mkParam(
        '2.1.7',
        'Monthly/quarterly attendance and continuity of teachers',
        'शिक्षक की मासिक/त्रैमासिक उपस्थिति और निरंतरता',
        7,
        ALL_BANDS,
        `विद्यालय में शिक्षकों की उपस्थिति 70% से कम है।`,
        `Teacher attendance in the school is less than 70%.`,
        `विद्यालय में शिक्षकों की उपस्थिति 70-90% के बीच है।`,
        `Teacher attendance in the school is between 70% and 90%.`,
        `विद्यालय शिक्षकों की उपस्थिति 90% से अधिक है।`,
        `Teacher attendance in the school is more than 90%.`
      ),
    ]),
    mkSub('D2_2.2', 'Quality of School Leadership', 'विद्यालय नेतृत्व की गुणवत्ता', 2, [
      mkParam(
        '2.2.1',
        'Academic involvement of the head teacher/principal',
        'प्रधानाध्यापक/प्रधानाचार्य की शैक्षणिक भागीदारी',
        1,
        ALL_BANDS,
        `विद्यालय में प्रधानाध्यापक/प्रधानाचार्य शिक्षण कार्य नहीं करते है।`,
        `The head teacher/principal does not undertake any teaching work in the school.`,
        `विद्यालय में प्रधानाध्यापक/प्रधानाचार्य कभी कभी शिक्षण कार्य करते हैं।`,
        `The head teacher/principal occasionally undertakes teaching work in the school.`,
        `विद्यालय में प्रधानाध्यापक/प्रधानाचार्य मानक के अनुसार शिक्षण कार्य करते हैं।`,
        `The head teacher/principal undertakes teaching work in the school as per the prescribed norm.`
      ),
      mkParam(
        '2.2.2',
        'Teacher professional development',
        'शिक्षक का व्यावसायिक विकास',
        2,
        ALL_BANDS,
        `शिक्षक के व्यावसायिक विकास की कोई व्यवस्थित व्यवस्था नहीं है।`,
        `There is no systematic arrangement for teacher professional development.`,
        `शिक्षक के व्यावसायिक विकास की वार्षिक योजना है। नियमित प्रशिक्षण और फॉलो-अप सहयोग प्रदान किया जाता है।`,
        `There is an annual plan for teacher professional development. Regular training and follow-up support are provided.`,
        `डेटा आधारित सतत व्यावसायिक विकास होता है। प्रशिक्षण के दौरान सीखी गयी जानकारी को शिक्षक अपनी कक्षा में लागू करते हैं और आवश्यकता पड़ने पर इस प्रक्रिया में अपने साथी शिक्षकों (Peer collaboration) की मदद भी लेते हैं।`,
        `Data-driven continuous professional development takes place. Teachers apply what they learn during training in their classrooms, and take help from peer teachers (peer collaboration) in this process when needed.`
      ),
      mkParam(
        '2.2.3',
        'Supervision and feedback mechanism',
        'पर्यवेक्षण और फीडबैक व्यवस्था',
        3,
        ALL_BANDS,
        `प्रधानाध्यापक/प्रधानाचार्य द्वारा नियमित रूप से कक्षा अवलोकन नहीं होता है। शिक्षकों के शिक्षण योजना पर भी फीडबैक सीमित है।`,
        `The head teacher/principal does not regularly conduct classroom observations. Feedback on teachers' lesson plans is also limited.`,
        `प्रधानाध्यापक/प्रधानाचार्य द्वारा कभी-कभी शिक्षकों के शिक्षण योजना को देखा जाता है और साप्ताहिक स्तर पर कक्षा अवलोकन किया जाता है। शिक्षकों को उपयोगी फीडबैक दिया जाता है।`,
        `The head teacher/principal occasionally reviews teachers' lesson plans and conducts classroom observations on a weekly basis. Useful feedback is given to teachers.`,
        `प्रधानाध्यापक/प्रधानाचार्य द्वारा शिक्षकों के सभी शिक्षण योजना को देखा जाता है और प्रतिदिन कम से कम एक कक्षा प्रक्रिया का अवलोकन किया जाता है। शिक्षकों को व्यक्तिगत एवं सामूहिक रूप से उपयोगी फीडबैक दिया जाता है और सुधार ट्रैक किए जाते हैं।`,
        `The head teacher/principal reviews all teachers' lesson plans and observes at least one classroom process every day. Teachers are given useful feedback both individually and collectively, and improvements are tracked.`
      ),
      mkParam(
        '2.2.4',
        'Protection against sexual harassment (POSH)',
        'यौन उत्पीड़न से सुरक्षा (POSH)',
        4,
        ALL_BANDS,
        `स्टाफ में POSH के प्रति जागरूकता का अभाव है। शिकायत निवारण की कोई स्पष्ट व्यवस्था नहीं है। 10 से अधिक स्टाफ वाले विद्यालय में समिति नहीं बनी है या 10 से कम स्टाफ वाले विद्यालय में LCC की जानकारी प्रदर्शित नहीं है।`,
        `Staff lack awareness of POSH. There is no clear grievance-redressal mechanism. In schools with more than 10 staff, a committee has not been formed, or in schools with fewer than 10 staff, LCC information is not displayed.`,
        `स्टाफ POSH से परिचित है; 10+ स्टाफ वाले विद्यालय में समिति गठित है या 10 से कम स्टाफ वाले विद्यालय में LCC की जानकारी प्रदर्शित है। शिकायत निवारण की व्यवस्था उपलब्ध है।`,
        `Staff are familiar with POSH; in schools with 10+ staff, a committee has been formed, or in schools with fewer than 10 staff, LCC information is displayed. A grievance-redressal mechanism is available.`,
        `POSH तंत्र सक्रिय और प्रभावी है; समिति नियमित रूप से कार्य करती है या LCC की जानकारी प्रमुखता से प्रदर्शित है। लिखित नीति, हेल्पलाइन नंबर, शिकायत अभिलेख और स्टाफ का वार्षिक प्रशिक्षण सुनिश्चित है।`,
        `The POSH mechanism is active and effective; the committee functions regularly, or LCC information is prominently displayed. A written policy, helpline number, complaint records, and annual staff training are all ensured.`
      ),
      mkParam(
        '2.2.5',
        'Teacher recognition and encouragement',
        'शिक्षक सम्मान एवं प्रोत्साहन',
        5,
        ALL_BANDS,
        `शिक्षकों के अच्छे कार्य की सराहना कभी-कभी होती है; प्रोत्साहन की व्यवस्था नियमित नहीं है।`,
        `Teachers' good work is occasionally appreciated; there is no regular system of encouragement.`,
        `शिक्षकों के अच्छे कार्य की नियमित सराहना होती है; नवाचार करने वाले शिक्षकों को प्रोत्साहित किया जाता है।`,
        `Teachers' good work is regularly appreciated; teachers who innovate are encouraged.`,
        `शिक्षकों को नियमित रूप से प्रोत्साहन मिलता है; नवाचार के लिए संसाधन और मंच उपलब्ध हैं तथा उत्कृष्ट कार्य को औपचारिक रूप से सम्मानित और प्रदर्शित किया जाता है।`,
        `Teachers regularly receive encouragement; resources and platforms are available for innovation, and outstanding work is formally recognized and showcased.`
      ),
      mkParam(
        '2.2.6',
        'Student enrollment and transition',
        'विद्यार्थियों का नामांकन एवं प्रगमन',
        6,
        ALL_BANDS,
        `प्राथमिक हेतु कैचमेंट एरिया के 90 प्रतिशत बच्चे कक्षा 1-5 में नामांकित हैं एवं कक्षा 5 उत्तीर्ण 90% बच्चे कक्षा 6 में प्रवेश लेते हैं। उच्च प्राथमिक हेतु कैचमेंट एरिया के 90 प्रतिशत बच्चे कक्षा 6-8 में नामांकित हैं एवं कक्षा 8 उत्तीर्ण 90% बच्चे कक्षा 9 में प्रवेश लेते हैं। माध्यमिक हेतु कैचमेंट एरिया के 90 प्रतिशत बच्चे कक्षा 9-12 में नामांकित हैं एवं कक्षा 12 उत्तीर्ण 90% बच्चे डिग्री कॉलेज में प्रवेश लेते हैं।`,
        `For primary, 90 percent of children in the catchment area are enrolled in classes 1-5, and 90% of children who pass class 5 join class 6. For upper primary, 90 percent of children in the catchment area are enrolled in classes 6-8, and 90% of children who pass class 8 join class 9. For secondary, 90 percent of children in the catchment area are enrolled in classes 9-12, and 90% of children who pass class 12 join a degree college.`,
        `प्राथमिक हेतु कैचमेंट एरिया के 90-95 प्रतिशत बच्चे कक्षा 1-5 में नामांकित हैं एवं कक्षा 5 उत्तीर्ण 95% बच्चे कक्षा 6 में प्रवेश लेते हैं। उच्च प्राथमिक हेतु 90-95 प्रतिशत नामांकित एवं कक्षा 8 उत्तीर्ण 95% कक्षा 9 प्रवेश। माध्यमिक हेतु 90-95 प्रतिशत नामांकित एवं कक्षा 12 उत्तीर्ण 95% डिग्री कॉलेज प्रवेश।`,
        `For primary, 90-95 percent of children in the catchment area are enrolled in classes 1-5, and 95% of children who pass class 5 join class 6. For upper primary, 90-95 percent are enrolled, and 95% of those who pass class 8 join class 9. For secondary, 90-95 percent are enrolled, and 95% of those who pass class 12 join a degree college.`,
        `प्राथमिक हेतु कैचमेंट एरिया के 95-100 प्रतिशत बच्चे कक्षा 1-5 में नामांकित हैं एवं कक्षा 5 उत्तीर्ण 100% बच्चे कक्षा 6 में प्रवेश लेते हैं। उच्च प्राथमिक हेतु 95-100 प्रतिशत नामांकित एवं कक्षा 8 उत्तीर्ण 100% कक्षा 9 प्रवेश। माध्यमिक हेतु 95-100 प्रतिशत नामांकित एवं कक्षा 12 उत्तीर्ण 100% डिग्री कॉलेज प्रवेश।`,
        `For primary, 95-100 percent of children in the catchment area are enrolled in classes 1-5, and 100% of children who pass class 5 join class 6. For upper primary, 95-100 percent are enrolled, and 100% of those who pass class 8 join class 9. For secondary, 95-100 percent are enrolled, and 100% of those who pass class 12 join a degree college.`
      ),
    ]),
  ]),

  mkDomain('D3', 'Teaching and Learning', 'शिक्षण एवं अधिगम', 3, 20, [
    mkSub('D3_3.1', 'Curriculum and Instruction', 'पाठ्यक्रम और अनुदेशन', 1, [
      mkParam(
        '3.1.1',
        'Curriculum alignment and its timely completion',
        'पाठ्यक्रम संरेखण और उसकी समयबद्ध पूर्णता',
        1,
        ALL_BANDS,
        `वार्षिक शिक्षण योजना नहीं है। शिक्षकों के पास शिक्षण योजना/शिक्षक डायरी नहीं है। पाठ्यक्रम समय पर पूरा नहीं होता है।`,
        `There is no annual teaching plan. Teachers do not have a lesson plan/teacher diary. The curriculum is not completed on time.`,
        `वार्षिक शिक्षण योजना है, परन्तु लागू नहीं की जा रही है। ज्यादातर शिक्षकों के पास शिक्षण योजना/शिक्षक डायरी है और उसका उपयोग होता है। पाठ्यक्रम समय पर पूरा नहीं होता है।`,
        `An annual teaching plan exists, but it is not being implemented. Most teachers have a lesson plan/teacher diary and use it. The curriculum is not completed on time.`,
        `वार्षिक शिक्षण योजना है और उसकी मॉनिटरिंग होती है। सभी शिक्षकों के पास शिक्षण योजना/शिक्षक डायरी है और उसका उपयोग होता है। पाठ्यक्रम समय पर पूरा होता है।`,
        `An annual teaching plan exists and is monitored. All teachers have a lesson plan/teacher diary and use it. The curriculum is completed on time.`
      ),
      mkParam(
        '3.1.2',
        'Quality of lesson plans',
        'शिक्षण योजना की गुणवत्ता',
        2,
        ALL_BANDS,
        `50% से कम शिक्षकों की शिक्षण योजनाएँ अद्यतन नहीं हैं। उनका कक्षा में उपयोग नहीं होता है। शिक्षकों की तैयारी भी नहीं दिखती है।`,
        `Lesson plans are up to date for fewer than 50% of teachers. They are not used in the classroom. Teachers also do not appear prepared.`,
        `50% से 80% शिक्षकों की शिक्षण योजनाओं में उद्देश्य, गतिविधियाँ और आकलन सम्मिलित है, परन्तु इनका उपयोग आंशिक और अनियमित है।`,
        `For 50% to 80% of teachers, lesson plans include objectives, activities and assessment, but their use is partial and irregular.`,
        `80% से अधिक शिक्षकों की शिक्षण में स्पष्ट उद्देश्य, विविध गतिविधियाँ और आकलन सम्मिलित हैं। इनका उपयोग कक्षा में नियमित रूप से होता है और ये बच्चों की जरूरतों के अनुसार अपडेट की जाती हैं।`,
        `For more than 80% of teachers, teaching includes clear objectives, varied activities and assessment. These are used regularly in the classroom and are updated according to children's needs.`
      ),
      mkParam(
        '3.1.3',
        'Activity-based learning',
        'गतिविधि आधारित अधिगम',
        3,
        ALL_BANDS,
        `शिक्षण के दौरान विद्यार्थी-केंद्रित गतिविधियों का अभाव रहता है, जिससे अधिकांश विद्यार्थी निष्क्रिय बने रहते हैं।`,
        `Student-centred activities are lacking during teaching, leaving most students passive.`,
        `शिक्षण में कुछ विद्यार्थी-केंद्रित गतिविधियाँ सम्मिलित होती हैं, जिनमें कुछ विद्यार्थी सक्रिय भागीदारी करते हैं।`,
        `Some student-centred activities are included in teaching, in which some students actively participate.`,
        `शिक्षण पूर्णतः विद्यार्थी-केंद्रित गतिविधियों पर आधारित होता है, जिसमें सभी विद्यार्थी सक्रिय रूप से सहभागिता करते हैं और सीखने की प्रक्रिया में संलग्न रहते हैं।`,
        `Teaching is entirely based on student-centred activities, in which all students actively participate and remain engaged in the learning process.`
      ),
      mkParam(
        '3.1.4',
        'Operation of ICT/smart class',
        'ICT/स्मार्ट क्लास का संचालन',
        4,
        ALL_BANDS,
        `ICT का प्रयोग नहीं होता है या सप्ताह में एक दिन किया जाता है। स्मार्ट क्लास के उपकरण क्रियाशील नहीं हैं।`,
        `ICT is not used, or is used only one day a week. Smart class equipment is not functional.`,
        `ICT का प्रयोग प्रति सप्ताह 2-4 दिन किया जाता है और स्मार्ट क्लास के उपकरण क्रियाशील हैं परंतु उपयोग में नहीं हैं।`,
        `ICT is used 2-4 days per week, and smart class equipment is functional but not in use.`,
        `ICT का प्रयोग सप्ताह के सभी दिन किया जाता है। स्मार्ट क्लास के उपकरण क्रियाशील हैं और पूर्णतः उपयोग किये जाते हैं।`,
        `ICT is used every day of the week. Smart class equipment is functional and fully used.`
      ),
      mkParam(
        '3.1.5',
        'Pre-vocational exposure',
        'पूर्व-व्यावसायिक एक्सपोजर',
        5,
        ['UPPER_PRIMARY'],
        `विद्यालय में कोई भी वोकेशनल/व्यावसायिक कौशल आधारित कार्यक्रम संचालित नहीं है।`,
        `No vocational/skills-based programme is run in the school.`,
        `विद्यालय में त्रैमासिक आधार पर सीमित वोकेशनल/व्यावसायिक कौशल सत्र आयोजित किए जाते हैं।`,
        `Limited vocational/skills sessions are conducted in the school on a quarterly basis.`,
        `वार्षिक इंटीग्रेटेड प्रोग्राम है। नियमित तौर पर प्री-वोकेशनल सेशन आयोजित होते हैं। बच्चों के पोर्टफोलियो बनाए जाते हैं। बाहरी पार्टनरशिप और इंडस्ट्री विजिट होती हैं। 70% से अधिक छात्र कौशल/व्यावसायिक कार्यक्रमों को व्यवस्थित तरीके से सफलतापूर्वक पूरा करते हैं और प्रमाण पत्र प्राप्त करते हैं।`,
        `There is an annual integrated programme. Pre-vocational sessions are conducted regularly. Portfolios are created for children. There are external partnerships and industry visits. More than 70% of students successfully complete skills/vocational programmes in a structured manner and receive certificates.`
      ),
      mkParam(
        '3.1.6',
        'Vocational skills',
        'व्यावसायिक कौशल',
        6,
        ['SECONDARY'],
        `विद्यालय में कोई भी वोकेशनल/व्यावसायिक कौशल आधारित कार्यक्रम संचालित नहीं है।`,
        `No vocational/skills-based programme is run in the school.`,
        `विद्यालय में त्रैमासिक आधार पर सीमित वोकेशनल/व्यावसायिक कौशल सत्र आयोजित किए जाते हैं।`,
        `Limited vocational/skills sessions are conducted in the school on a quarterly basis.`,
        `विद्यालय में संरचित एवं एकीकृत वार्षिक वोकेशनल/कौशल कार्यक्रम संचालित है, जिसमें 70% से अधिक विद्यार्थी नियमित रूप से भाग लेकर सफलतापूर्वक पूर्ण करते हैं और प्रमाणन प्राप्त करते हैं।`,
        `A structured, integrated annual vocational/skills programme is run in the school, in which more than 70% of students regularly participate, successfully complete it, and receive certification.`
      ),
      mkParam(
        '3.1.7',
        'Use of mother tongue and local context',
        'मातृभाषा एवं स्थानीय संदर्भ का उपयोग',
        7,
        ['PRIMARY'],
        `मातृभाषा और स्थानीय संदर्भ का उपयोग नहीं होता; शिक्षण मुख्यतः एक ही भाषा तक सीमित रहता है।`,
        `Mother tongue and local context are not used; teaching remains mostly confined to a single language.`,
        `मातृभाषा और स्थानीय संदर्भ का आंशिक उपयोग किया जाता है; कुछ पाठों/गतिविधियों में सम्मिलित होता है।`,
        `Mother tongue and local context are used partially; they are included in some lessons/activities.`,
        `मातृभाषा और स्थानीय संदर्भ का नियमित और योजनाबद्ध उपयोग होता है; इससे बच्चों की समझ और सहभागिता स्पष्ट रूप से बढ़ती है।`,
        `Mother tongue and local context are used regularly and in a planned manner; this clearly increases children's understanding and participation.`
      ),
      mkParam(
        '3.1.8',
        'Gender equality and constitutional values',
        'लैंगिक समानता और संवैधानिक मूल्य',
        8,
        ALL_BANDS,
        `लैंगिक समानता और संवैधानिक मूल्यों पर आधारित गतिविधियाँ सीमित हैं, जिसके परिणामस्वरूप बच्चों के व्यवहार में इन मूल्यों का कम प्रभाव दिखाई देता है।`,
        `Activities based on gender equality and constitutional values are limited, as a result of which these values have little visible effect on children's behaviour.`,
        `लैंगिक समानता और संवैधानिक मूल्यों पर आधारित गतिविधियाँ कभी-कभी आयोजित होती हैं, जिससे कुछ बच्चों के व्यवहार में समानता और सम्मान के संकेत दिखाई देते हैं।`,
        `Activities based on gender equality and constitutional values are held occasionally, showing signs of equality and respect in some children's behaviour.`,
        `लैंगिक समानता और संवैधानिक मूल्यों पर आधारित गतिविधियाँ नियमित एवं संरचित रूप से संचालित होती हैं, जिससे कुछ बच्चों के व्यवहार में समानता और सम्मान जैसे मूल्य स्पष्ट रूप से परिलक्षित होते हैं।`,
        `Activities based on gender equality and constitutional values are conducted regularly and in a structured manner, clearly reflecting values such as equality and respect in some children's behaviour.`
      ),
    ]),
    mkSub('D3_3.2', 'Teaching-Learning Processes', 'शिक्षण-अधिगम प्रक्रियाएं', 2, [
      mkParam(
        '3.2.1',
        "Children's participation in the teaching-learning process",
        'शिक्षण अधिगम प्रक्रिया में बच्चों की भागीदारी',
        1,
        ALL_BANDS,
        `शिक्षण योजनाओं में बच्चों की प्रतिभागिता की योजना सुनिश्चित नहीं होती है और कक्षा मुख्यतः व्याख्यान आधारित रहती है।`,
        `Lesson plans do not ensure planning for children's participation, and classes remain mostly lecture-based.`,
        `अधिकांश शिक्षण योजनाओं में बच्चों की प्रतिभागिता की योजना सुनिश्चित होती है, परन्तु कक्षा में चर्चा, समूह कार्य और गतिविधियों का आंशिक उपयोग होता है।`,
        `Most lesson plans ensure planning for children's participation, but discussion, group work and activities are used only partially in class.`,
        `सभी शिक्षण योजनाओं में बच्चों की सक्रिय भागीदारी सुनिश्चित होती है और कक्षा में चर्चा, समूह कार्य व गतिविधियों का प्रभावी रूप से पूर्ण उपयोग किया जाता है।`,
        `All lesson plans ensure children's active participation, and discussion, group work and activities are used fully and effectively in class.`
      ),
      mkParam(
        '3.2.2',
        'Classroom management',
        'कक्षा प्रबंधन',
        2,
        ALL_BANDS,
        `सभी कक्षाएँ अव्यवस्थित रहती हैं जिससे सीखने की प्रक्रिया बाधित होती है।`,
        `All classrooms remain disorganized, which disrupts the learning process.`,
        `कुछ कक्षाएँ व्यवस्थित रहती हैं (जैसे बच्चों द्वारा गतिविधि में प्रतिभाग करना, शिक्षक के अनुदेशों का पालन करना आदि)।`,
        `Some classrooms remain well organized (such as children participating in activities, following the teacher's instructions, etc.).`,
        `सभी कक्षाएँ व्यवस्थित रहती हैं, सभी बच्चे सीखने की प्रक्रिया में प्रतिभाग करते हैं और एक दुसरे का सहयोग करते है।`,
        `All classrooms remain well organized; all children participate in the learning process and cooperate with one another.`
      ),
      mkParam(
        '3.2.3',
        "Children's attendance rate",
        'बच्चों की उपस्थिति दर',
        3,
        ALL_BANDS,
        `औसत उपस्थिति 75% से कम है; उपस्थिति अनियमित है और अनुपस्थिति अधिक रहती है।`,
        `Average attendance is less than 75%; attendance is irregular and absenteeism remains high.`,
        `औसत उपस्थिति 75%-80% के बीच है; उपस्थिति अपेक्षाकृत नियमित है और इसकी निगरानी की जाती है।`,
        `Average attendance is between 75% and 80%; attendance is relatively regular and is monitored.`,
        `औसत उपस्थिति 80% से अधिक है; उपस्थिति नियमित रहती है, सतत निगरानी होती है और अनुपस्थित बच्चों पर समयबद्ध फॉलो-अप किया जाता है।`,
        `Average attendance is more than 80%; attendance remains regular, continuous monitoring takes place, and timely follow-up is done for absent children.`
      ),
      mkParam(
        '3.2.4',
        'Questioning skills',
        'प्रश्न पूछने के कौशल',
        4,
        ALL_BANDS,
        `शिक्षण में प्रश्न पूछने के विविध कौशलों का उपयोग नहीं होता; कक्षा में मुख्यतः स्मरण (याद) आधारित प्रश्न पूछे जाते हैं।`,
        `Diverse questioning skills are not used in teaching; questions asked in class are mostly recall/memory-based.`,
        `शिक्षण में प्रश्न पूछने के विविध कौशलों का उपयोग होता है; कक्षा में बोध (समझ) आधारित प्रश्न भी पूछे जाते हैं।`,
        `Diverse questioning skills are used in teaching; comprehension-based questions are also asked in class.`,
        `शिक्षण में प्रश्न पूछने के विविध कौशलों का प्रभावी उपयोग होता है; कक्षा में अनुप्रयोग एवं सृजनात्मक सोच को बढ़ाने वाले प्रश्न नियमित रूप से पूछे जाते हैं।`,
        `Diverse questioning skills are used effectively in teaching; questions that promote application and creative thinking are regularly asked in class.`
      ),
      mkParam(
        '3.2.5',
        'Differentiated instruction',
        'विभेदित अनुदेशन / डिफरेंशिएटेड इंस्ट्रक्शन',
        5,
        ALL_BANDS,
        `विद्यार्थियों की अधिगम आवश्यकताओं के अनुसार शिक्षण विधियों में बदलाव नहीं किया जाता है।`,
        `Teaching methods are not adapted according to students' learning needs.`,
        `अधिकांश शिक्षकों द्वारा विद्यार्थियों की अधिगम आवश्यकताओं के अनुसार शिक्षण विधियों में बदलाव किया जाता है। ग्रुप वर्क और स्तर के अनुसार अलग-अलग टास्क दिए जाते हैं।`,
        `Most teachers adapt their teaching methods according to students' learning needs. Group work and level-appropriate tasks are assigned.`,
        `समस्त शिक्षकों द्वारा विद्यार्थियों की अधिगम आवश्यकताओं के अनुसार शिक्षण विधियों में बदलाव किया जाता है। कमजोर बच्चों के लिए अलग योजना बनाई जाती है और उन्हें व्यक्तिगत सपोर्ट दिया जाता है। प्रगति नियमित रूप से ट्रैक की जाती है।`,
        `All teachers adapt their teaching methods according to students' learning needs. Separate plans are made for weaker children, and they are given individual support. Progress is tracked regularly.`
      ),
      mkParam(
        '3.2.6',
        'Inclusive teaching',
        'समावेशी शिक्षण',
        6,
        ALL_BANDS,
        `समावेशी शिक्षण की कोई रणनीति नहीं है।`,
        `There is no strategy for inclusive teaching.`,
        `अधिकांश शिक्षक समावेशी शिक्षण रणनीतियाँ अपनाते हैं; कई कक्षाओं में आवश्यकतानुसार विज़ुअल, स्कैफोल्डिंग और लचीली बैठने की व्यवस्था का उपयोग होता है।`,
        `Most teachers adopt inclusive teaching strategies; visuals, scaffolding and flexible seating arrangements are used as needed in many classrooms.`,
        `सभी शिक्षक समावेशी शिक्षण रणनीतियाँ अपनाते हैं; सभी कक्षाओं में आवश्यकतानुसार विज़ुअल, स्कैफोल्डिंग और लचीली बैठने की व्यवस्था का प्रभावी उपयोग होता है।`,
        `All teachers adopt inclusive teaching strategies; visuals, scaffolding and flexible seating arrangements are used effectively as needed in all classrooms.`
      ),
      mkParam(
        '3.2.7',
        'Checking for understanding during the lesson (CFU)',
        'पाठ के दौरान बोध की जांच (CFU)',
        7,
        ALL_BANDS,
        `पाठ योजना में बोधात्मक एवं पुनरावलोकन प्रश्नों एवं प्रक्रियाओं को सम्मिलित नहीं किया जाता है।`,
        `Comprehension and review questions and processes are not included in the lesson plan.`,
        `अधिकांश शिक्षक पाठ योजना में बोधात्मक और पुनरावलोकन प्रश्नों व प्रक्रियाओं को सम्मिलित करते हैं। अधिकांश कक्षाओं में इनके अनुसार शिक्षण किया जाता है।`,
        `Most teachers include comprehension and review questions and processes in their lesson plans. Teaching is conducted accordingly in most classrooms.`,
        `सभी शिक्षक पाठ योजना में बोधात्मक और पुनरावलोकन प्रश्नों व प्रक्रियाओं को सम्मिलित करते हैं। सभी कक्षाओं में इनके अनुसार शिक्षण प्रभावी रूप से किया जाता है।`,
        `All teachers include comprehension and review questions and processes in their lesson plans. Teaching is conducted effectively according to these in all classrooms.`
      ),
      mkParam(
        '3.2.8',
        'Use of TLM (teaching-learning material)',
        'TLM का उपयोग',
        8,
        ALL_BANDS,
        `TLM का प्रयोग कक्षा शिक्षण में कम होता है। सिर्फ किताब से पढ़ाई होती है।`,
        `TLM is used little in classroom teaching. Teaching is done only from the textbook.`,
        `अधिकांश शिक्षक कुछ विषयों में आवश्यकतानुसार TLM का उपयोग करते है।`,
        `Most teachers use TLM as needed in some subjects.`,
        `समस्त शिक्षक समस्त विषयों में प्रतिदिन आवश्यकतानुसार TLM का उपयोग करते है।`,
        `All teachers use TLM as needed every day, across all subjects.`
      ),
      mkParam(
        '3.2.9',
        'Quality of teacher feedback',
        'टीचर फीडबैक की गुणवत्ता',
        9,
        ALL_BANDS,
        `विद्यार्थियों को उनके कार्य और प्रदर्शन पर सार्थक फीडबैक नहीं दिया जाता; केवल अंक या सामान्य टिप्पणी दी जाती है।`,
        `Students are not given meaningful feedback on their work and performance; only marks or general comments are given.`,
        `विद्यार्थियों को स्पष्ट और मानदंडों से जुड़ा फीडबैक दिया जाता है, जो आकलन के बाद नियमित रूप से साझा किया जाता है।`,
        `Students are given clear, criteria-linked feedback, which is shared regularly after assessment.`,
        `विद्यार्थियों को कक्षा में ही समय पर और स्पष्ट फीडबैक दिया जाता है; यह सीख को सुधारने में मदद करता है और विद्यार्थी उस पर काम करते हैं।`,
        `Students are given timely, clear feedback within the classroom itself; this helps improve learning, and students act on it.`
      ),
      mkParam(
        '3.2.10',
        'Creativity (art, projects, performance)',
        'रचनात्मकता (कला, प्रोजेक्ट, प्रदर्शन)',
        10,
        ALL_BANDS,
        `कक्षा में रचनात्मक या परियोजना आधारित गतिविधियाँ सीमित होती हैं; बच्चों की अभिव्यक्ति के अवसर कम होते हैं।`,
        `Creative or project-based activities in the classroom are limited; opportunities for children's self-expression are few.`,
        `कक्षा में नियोजित रचनात्मक या परियोजना गतिविधियाँ होती हैं; बच्चों का कार्य कभी-कभी साझा किया जाता है।`,
        `Planned creative or project activities take place in the classroom; children's work is occasionally shared.`,
        `कक्षा में रचनात्मक एवं परियोजना कार्य नियमित रूप से होता है; बच्चों के विचार, कला और प्रस्तुतियाँ स्पष्ट रूप से प्रदर्शित की जाती हैं।`,
        `Creative and project work takes place regularly in the classroom; children's ideas, art and presentations are prominently displayed.`
      ),
      mkParam(
        '3.2.11',
        'Effective use of instructional time',
        'शिक्षण समय का प्रभावी उपयोग',
        11,
        ALL_BANDS,
        `अधिकांश कक्षाओं में देर, अव्यवस्था या अनुशासन के कारण शिक्षण समय नष्ट होता है और नियोजित कार्य पूरा नहीं हो पाता।`,
        `In most classes, teaching time is lost due to lateness, disorganization or discipline issues, and planned work is not completed.`,
        `कई कक्षाओं में शिक्षण समय पर शुरू और समाप्त होता है, पर पीरियड परिवर्तन के दौरान कुछ समय व्यर्थ होता है।`,
        `In many classes, teaching starts and ends on time, but some time is wasted during period changes.`,
        `सभी कक्षाओं में शिक्षण समय का प्रभावी उपयोग होता है और पूरी अवधि में बच्चों की सक्रिय सहभागिता बनी रहती है।`,
        `Instructional time is used effectively in all classes, and children's active participation is maintained throughout the period.`
      ),
    ]),
    mkSub('D3_3.3', 'Co-curricular Activities', 'सह-पाठ्यक्रम गतिविधियाँ', 3, [
      mkParam(
        '3.3.1',
        'Implementation of Social-Emotional Learning (SEL)',
        'सामाजिक-भावनात्मक अधिगम (SEL) का क्रियान्वयन',
        1,
        ALL_BANDS,
        `शिक्षकों में SEL की समझ और उपयोग न्यून है तथा कक्षा में इसका व्यवस्थित प्रयोग नहीं होता है।`,
        `Teachers' understanding and use of SEL is low, and it is not applied systematically in the classroom.`,
        `शिक्षकों में SEL की समझ है और शिक्षकों द्वारा कक्षा में इसका आंशिक उपयोग किया जाता है।`,
        `Teachers have an understanding of SEL and apply it partially in the classroom.`,
        `शिक्षकों द्वारा SEL का नियमित और योजनाबद्ध उपयोग होता है, जिससे आत्मविश्वास, भावनात्मक संतुलन और सकारात्मक व्यवहार में स्पष्ट सुधार दिखाई देता है।`,
        `Teachers apply SEL regularly and in a planned manner, resulting in clear improvement in confidence, emotional balance and positive behaviour.`
      ),
      mkParam(
        '3.3.2',
        'Participation in sports, dance, music and art',
        'खेल, नृत्य, संगीत, कला में भागीदारी',
        2,
        ALL_BANDS,
        `समय सारिणी में खेल, नृत्य, संगीत और कला के लिए कोई निर्धारित पीरियड नहीं है।`,
        `There is no dedicated period for sports, dance, music and art in the timetable.`,
        `समय सारिणी में इन गतिविधियों के लिए पीरियड निर्धारित हैं, पर उनका संचालन नियमित नहीं है।`,
        `Periods for these activities are set in the timetable, but they are not conducted regularly.`,
        `समय सारिणी के अनुसार खेल, नृत्य, संगीत और कला गतिविधियाँ नियमित रूप से संचालित होती हैं और सभी विद्यार्थी सक्रिय रूप से भाग लेते हैं।`,
        `Sports, dance, music and art activities are conducted regularly as per the timetable, and all students actively participate.`
      ),
      mkParam(
        '3.3.3',
        'Educational excursions and exposure visits',
        'शैक्षणिक भ्रमण और एक्सपोजर विजिट',
        3,
        ALL_BANDS,
        `शैक्षणिक भ्रमण/एक्सपोजर विजिट का आयोजन नहीं होता; सीखने का अनुभव कक्षा तक सीमित रहता है।`,
        `Educational excursions/exposure visits are not organized; the learning experience remains confined to the classroom.`,
        `सीमित संख्या में शैक्षणिक भ्रमण/एक्सपोजर विजिट आयोजित होते हैं, जो मुख्यतः पाठ्यक्रम से जुड़े होते हैं।`,
        `A limited number of educational excursions/exposure visits are organized, mostly linked to the curriculum.`,
        `नियमित और योजनाबद्ध रूप से शैक्षणिक भ्रमण/एक्सपोजर विजिट आयोजित होते हैं, जिनसे बच्चों को वास्तविक जीवन, करियर और विशेषज्ञों से जुड़ने के अवसर मिलते हैं।`,
        `Educational excursions/exposure visits are organized regularly and in a planned manner, giving children opportunities to connect with real life, careers and experts.`
      ),
      mkParam(
        '3.3.4',
        'Intra-school/inter-school sports competitions',
        'अंतः विद्यालयी/अंतर्विद्यालयी खेल प्रतियोगिताएँ (इंट्रा/इंटर स्कूल)',
        4,
        ALL_BANDS,
        `विद्यालय स्तर पर खेल प्रतियोगिताएँ अनियमित और बिना योजना के आयोजित होती हैं; सीमित खेल होते हैं और अंतर-विद्यालयी प्रतियोगिताओं में भागीदारी नहीं होती।`,
        `Sports competitions at the school level are held irregularly and without planning; a limited range of games are held, and there is no participation in inter-school competitions.`,
        `विद्यालय स्तर पर खेल प्रतियोगिताएँ नियमित रूप से आयोजित होती हैं; अधिकांश खेल सम्मिलित होते हैं, पर अंतर्विद्यालयी प्रतियोगिताओं में भागीदारी सीमित रहती है।`,
        `Sports competitions are held regularly at the school level; most games are included, but participation in inter-school competitions remains limited.`,
        `अंतःविद्यालयी और अंतर्विद्यालयी खेल प्रतियोगिताएँ योजनाबद्ध और नियमित रूप से आयोजित होती हैं; विद्यार्थियों का चयन राज्य एवं राष्ट्रीय स्तर तक होता है।`,
        `Intra-school and inter-school sports competitions are held in a planned and regular manner; students are selected up to state and national level.`
      ),
      mkParam(
        '3.3.5',
        'Other intra-school/inter-school competitions',
        'अंतः विद्यालयी/अंतर्विद्यालयी अन्य प्रतियोगिताएं (इंट्रा/इंटर स्कूल)',
        5,
        ALL_BANDS,
        `कम प्रतियोगिताएँ आयोजित होती हैं; आयोजन अनियमित होता है और विद्यार्थियों की भागीदारी सीमित रहती है, अंतर्विद्यालयी स्तर पर भागीदारी नहीं होती।`,
        `Few competitions are organized; organization is irregular, student participation remains limited, and there is no participation at the inter-school level.`,
        `कई प्रतियोगिताएँ योजनाबद्ध रूप से आयोजित होती हैं; विद्यार्थी नियमित भाग लेते हैं, पर अंतर्विद्यालयी स्तर पर भागीदारी सीमित रहती है।`,
        `Several competitions are organized in a planned manner; students participate regularly, but participation at the inter-school level remains limited.`,
        `अधिकांश प्रतियोगिताएँ योजनाबद्ध और नियमित रूप से आयोजित होती हैं; अंतःविद्यालयी और अंतर्विद्यालयी दोनों स्तरों पर विद्यार्थियों की सक्रिय भागीदारी होती है और उच्च स्तर तक चयन होता है।`,
        `Most competitions are organized in a planned and regular manner; students actively participate at both intra-school and inter-school levels, and selection extends up to higher levels.`
      ),
      mkParam(
        '3.3.6',
        'Student-led activities',
        'विद्यार्थियों के नेतृत्व में गतिविधियां',
        6,
        ALL_BANDS,
        `विद्यार्थियों की नेतृत्व भूमिका सीमित है; वे केवल कक्षा मॉनिटर तक सीमित रहते हैं और अन्य गतिविधियाँ (मॉर्निंग असेंबली, क्लब, हाउस) शिक्षक/स्टाफ द्वारा संचालित होती हैं।`,
        `Students' leadership role is limited; they are confined to being class monitors only, and other activities (morning assembly, clubs, houses) are run by teachers/staff.`,
        `विद्यार्थी शिक्षक/स्टाफ के निर्देशन में मॉर्निंग असेंबली, हाउस, क्लब आदि गतिविधियों का आयोजन करते हैं।`,
        `Students organize activities such as morning assembly, house and club activities under the guidance of teachers/staff.`,
        `विद्यार्थी मॉर्निंग असेंबली, हाउस, क्लब आदि सभी गतिविधियों का स्वयं आयोजन एवं संचालन करते हैं; शिक्षक संरक्षक/मार्गदर्शक की भूमिका में होते हैं।`,
        `Students themselves organize and run all activities such as morning assembly, house and club activities; teachers act as mentors/guides.`
      ),
      mkParam(
        '3.3.7',
        'Annual events (annual day, sports day)',
        'वार्षिक कार्यक्रम (वार्षिकोत्सव, खेल दिवस)',
        7,
        ALL_BANDS,
        `वार्षिक कार्यक्रम/समारोह आयोजित होते हैं, पर वे बिना योजना के होते हैं और विद्यार्थियों की भागीदारी सीमित रहती है।`,
        `Annual events/functions are organized, but without planning, and student participation remains limited.`,
        `वार्षिक कार्यक्रम/समारोह योजनाबद्ध रूप से आयोजित होते हैं; विद्यार्थियों की भागीदारी संतोषजनक रहती है।`,
        `Annual events/functions are organized in a planned manner; student participation remains satisfactory.`,
        `कैलेंडर के अनुसार वार्षिक कार्यक्रम/समारोह सुव्यवस्थित और योजनाबद्ध होते हैं; अधिकांश विद्यार्थियों की सक्रिय भागीदारी होती है और अभिभावकों व समुदाय की सहभागिता भी सुनिश्चित होती है।`,
        `Annual events/functions are well organized and planned as per the calendar; most students actively participate, and the involvement of parents and the community is also ensured.`
      ),
      mkParam(
        '3.3.8',
        'Celebrating festivals',
        'त्योहार मनाना',
        8,
        ALL_BANDS,
        `केवल राष्ट्रीय त्योहार मनाए जाते हैं; सामाजिक त्योहारों में सांस्कृतिक विविधता का समावेश सीमित रहता है और विद्यार्थियों की भागीदारी कम होती है।`,
        `Only national festivals are celebrated; the inclusion of cultural diversity in social festivals remains limited, and student participation is low.`,
        `राष्ट्रीय और सामाजिक दोनों त्योहार सांस्कृतिक विविधता के अनुसार मनाए जाते हैं; विद्यार्थियों की भागीदारी मध्यम स्तर की रहती है।`,
        `Both national and social festivals are celebrated in keeping with cultural diversity; student participation remains at a moderate level.`,
        `सभी राष्ट्रीय एवं सामाजिक त्योहार सांस्कृतिक विविधता के साथ योजनाबद्ध रूप से मनाए जाते हैं; अधिकांश विद्यार्थियों की सक्रिय भागीदारी होती है और समुदाय की सहभागिता भी सुनिश्चित होती है।`,
        `All national and social festivals are celebrated in a planned manner reflecting cultural diversity; most students actively participate, and community involvement is also ensured.`
      ),
    ]),
  ]),

  mkDomain('D4', 'Assessment and Learning Outcomes', 'आकलन एवं सीखने के परिणाम', 4, 20, [
    mkSub('D4_4.1', 'Assessment Processes', 'आकलन प्रक्रियाएँ', 1, [
      mkParam(
        '4.1.1',
        'Regularity of assessment',
        'आकलन की नियमितता',
        1,
        ALL_BANDS,
        `कक्षा स्तरीय आकलन नियमित तौर पर नहीं किया जाता है।`,
        `Classroom-level assessment is not conducted regularly.`,
        `शैक्षणिक योजना के अनुसार कक्षा स्तरीय आकलन नियमित तौर पर किया जाता है।`,
        `Classroom-level assessment is conducted regularly as per the academic plan.`,
        `अच्छी तरह व्यवस्थित कक्षा स्तरीय आकलन चक्र, समय-समय पर टेस्ट, एफ.एल.एन. जांच, प्रोजेक्ट आधारित आकलन किया जाता है। इसके आधार पर शिक्षण योजना में आवश्यक परिवर्तन किया जाता है।`,
        `A well-organized cycle of classroom-level assessment is followed, including periodic tests, FLN checks, and project-based assessment. Necessary changes are made to the lesson plan based on this.`
      ),
      mkParam(
        '4.1.2',
        'Timeliness of feedback',
        'फीडबैक की समयबद्धता',
        2,
        ALL_BANDS,
        `50% से कम बच्चों को फीडबैक मिलता है। वह ज्यादातर अंक आधारित या सही-गलत तक सीमित रहता है।`,
        `Fewer than 50% of children receive feedback. It is mostly limited to marks or right/wrong indications.`,
        `50% से 80% बच्चों को फीडबैक मिलता है, जिसमें सुधार के सुझाव होते हैं।`,
        `50% to 80% of children receive feedback that includes suggestions for improvement.`,
        `80% से अधिक बच्चों को समय पर, स्पष्ट और उपयोगी फीडबैक मिलता है, जिसके आधार पर वे अपने काम में सुधार करते हैं।`,
        `More than 80% of children receive timely, clear and useful feedback, based on which they improve their work.`
      ),
      mkParam(
        '4.1.3',
        'Analysis of assessment data',
        'आकलन डेटा का विश्लेषण',
        3,
        ALL_BANDS,
        `आकलन डाटा का कोई विश्लेषण नहीं होता है। सिर्फ अंकों के रिकॉर्ड रखे जाते हैं। शिक्षकों को आकलन के आधार पर गैप का पता नहीं होता है।`,
        `No analysis of assessment data takes place. Only records of marks are kept. Teachers are not aware of learning gaps based on assessments.`,
        `शिक्षक कक्षा के डेटा का विश्लेषण करके शिक्षण योजना बनाते हैं तथा विद्यार्थियों को कभी-कभी लक्षित सहायता देते हैं।`,
        `Teachers analyze classroom data to make lesson plans and occasionally provide targeted support to students.`,
        `शिक्षक कॉम्पिटेंसी/आइटम लेवल डेटा का विश्लेषण करके प्रत्येक बच्चे के लिये शिक्षण योजना बनाते हैं, विद्यार्थियों को लक्षित सहायता देते हैं।`,
        `Teachers analyze competency/item-level data to create a lesson plan for each child and provide targeted support to students.`
      ),
      mkParam(
        '4.1.4',
        'Self-reflection and self-assessment',
        'आत्म-चिंतन और स्व-आकलन',
        4,
        ALL_BANDS,
        `कुछ कक्षाओं में ही बच्चों को यह समझने का अवसर मिलता है कि उन्होंने क्या सीखा है और आगे क्या सीखना है।`,
        `Only in some classrooms do children get the opportunity to understand what they have learned and what they need to learn next.`,
        `अधिकतर कक्षाओं में बच्चे अपनी प्रगति पर विचार करते हैं, पर सीखने के लक्ष्यों और आगे की दिशा पर सीमित स्पष्टता होती है।`,
        `In most classrooms, children reflect on their progress, but there is limited clarity on learning goals and the way forward.`,
        `सभी कक्षाओं में बच्चे अपने सीखने के लक्ष्य स्पष्ट रूप से पहचानते हैं, अपनी प्रगति पर विचार करते हैं और आगे के कदम तय करते हैं।`,
        `In all classrooms, children clearly identify their learning goals, reflect on their progress, and decide their next steps.`
      ),
      mkParam(
        '4.1.5',
        'Targeted remedial support',
        'लक्षित सुधारात्मक सहायता',
        5,
        ALL_BANDS,
        `बच्चों के लर्निंग गैप की पहचान नहीं होती है। सबको एक जैसा पढ़ाया जाता है।`,
        `Children's learning gaps are not identified. Everyone is taught in the same way.`,
        `लर्निंग गैप वाले बच्चों की पहचान की जाती है। उनका रिकॉर्ड रखा जाता है। आवश्यकता के अनुसार शिक्षण कार्य किया जाता है।`,
        `Children with learning gaps are identified. Their records are kept. Teaching is carried out according to their needs.`,
        `लर्निंग गैप वाले बच्चों का रिकॉर्ड रखा जाता है। लर्निंग गैप के आधार पर प्रत्येक बच्चे हेतु योजना बनाई जाती है तथा उनकी प्रगति ट्रैक की जाती है।`,
        `Records are kept of children with learning gaps. A plan is made for each child based on their learning gaps, and their progress is tracked.`
      ),
    ]),
    mkSub('D4_4.2', 'Academic Outcomes', 'शैक्षणिक परिणाम', 2, [
      mkParam(
        '4.2.1',
        'Summative assessment results, class-wise',
        'योगात्मक आकलन के परिणाम कक्षावार',
        1,
        ALL_BANDS,
        `50% से कम विद्यार्थी 80% या उससे अधिक अंक प्राप्त करते हैं।`,
        `Fewer than 50% of students score 80% or more marks.`,
        `50% से 75% विद्यार्थी 80% या उससे अधिक अंक प्राप्त करते हैं।`,
        `50% to 75% of students score 80% or more marks.`,
        `75% से अधिक विद्यार्थी 80% या उससे अधिक अंक प्राप्त करते हैं।`,
        `More than 75% of students score 80% or more marks.`
      ),
      mkParam(
        '4.2.2',
        'FLN reading proficiency',
        'एफ.एल.एन. रीडिंग प्रोफिशिएंसी',
        2,
        ['PRIMARY'],
        `बच्चों में बुनियादी पढ़ने-लिखने और संख्या ज्ञान की दक्षता कम है; सरल पाठ पढ़ने और मूल गणनाओं में कठिनाई होती है।`,
        `Children have low proficiency in basic literacy and numeracy; they face difficulty reading simple texts and doing basic calculations.`,
        `बच्चे बुनियादी पढ़ने-लिखने और संख्या ज्ञान में सक्षम हैं। सरल पाठ पढ़ते हैं और मूल गणनाएँ करते हैं, पर समझ और अनुप्रयोग सीमित है।`,
        `Children are competent in basic literacy and numeracy. They read simple texts and perform basic calculations, but comprehension and application are limited.`,
        `बच्चे धाराप्रवाह पढ़ते-लिखते हैं, पाठ को समझते हैं और संख्यात्मक कौशल का सही एवं संदर्भ आधारित उपयोग करते हैं।`,
        `Children read and write fluently, understand texts, and use numerical skills correctly and in context.`
      ),
      mkParam(
        '4.2.3',
        'Board exam results',
        'बोर्ड परीक्षा परिणाम',
        3,
        ['SECONDARY'],
        `50% से कम विद्यार्थी 80% या उससे अधिक अंक प्राप्त करते हैं।`,
        `Fewer than 50% of students score 80% or more marks.`,
        `50% से 75% विद्यार्थी 80% या उससे अधिक अंक प्राप्त करते हैं।`,
        `50% to 75% of students score 80% or more marks.`,
        `75% से अधिक विद्यार्थी 80% या उससे अधिक अंक प्राप्त करते हैं।`,
        `More than 75% of students score 80% or more marks.`
      ),
      mkParam(
        '4.2.4',
        'Participation in competitive examinations (Vidyagyan, Atal Awasiya Vidyalaya, Jawahar Navodaya Vidyalaya/Navodaya, Olympiads, etc.)',
        'प्रतियोगी परीक्षाओं (विद्याज्ञान, अटल आवासीय विद्यालय, जवाहर नवोदय विद्यालय/नवोदय, ओलंपियाड आदि) में प्रतिभागिता',
        4,
        ['PRIMARY'],
        `5% से कम विद्यार्थी राज्य या/एवम राष्ट्रीय स्तर की प्रतियोगी परीक्षाओं में प्रतिभाग करते हैं।`,
        `Fewer than 5% of students participate in state and/or national-level competitive examinations.`,
        `5% से 25% विद्यार्थी राज्य या/एवम राष्ट्रीय स्तर की प्रतियोगी परीक्षाओं में प्रतिभाग करते हैं और 1-2 बच्चे सफल होते हैं।`,
        `5% to 25% of students participate in state and/or national-level competitive examinations, and 1-2 children succeed.`,
        `25% से अधिक विद्यार्थी राज्य या/एवम राष्ट्रीय स्तर की प्रतियोगी परीक्षाओं में प्रतिभाग करते हैं और 2 से अधिक बच्चे सफल होते हैं।`,
        `More than 25% of students participate in state and/or national-level competitive examinations, and more than 2 children succeed.`
      ),
      mkParam(
        '4.2.5',
        'Participation in competitive examinations (Olympiads, NTSE, National Means-cum-Merit Scholarship, etc.)',
        'प्रतियोगी परीक्षाओं (ओलंपियाड, एनटीएसई, नेशनल मीन्स-कम-मेरिट स्कालरशिप आदि) में प्रतिभागिता',
        5,
        ['UPPER_PRIMARY', 'SECONDARY'],
        `5% से कम विद्यार्थी राज्य या/एवम राष्ट्रीय स्तर की प्रतियोगी परीक्षाओं में प्रतिभाग करते हैं।`,
        `Fewer than 5% of students participate in state and/or national-level competitive examinations.`,
        `5% से 25% विद्यार्थी प्रतिभाग करते हैं और 1-2 बच्चे सफल होते हैं।`,
        `5% to 25% of students participate, and 1-2 children succeed.`,
        `25% से अधिक विद्यार्थी प्रतिभाग करते हैं और 2 से अधिक बच्चे सफल होते हैं।`,
        `More than 25% of students participate, and more than 2 children succeed.`
      ),
      mkParam(
        '4.2.6',
        'Participation in competitive examinations (NEET, JEE, CUET, KVPY, etc.)',
        'प्रतियोगी परीक्षाओं (NEET, JEE, CUET, KVPY आदि) में प्रतिभागिता',
        6,
        ['SECONDARY'],
        `5% से कम विद्यार्थी राज्य या/एवम राष्ट्रीय स्तर की प्रतियोगी परीक्षाओं में प्रतिभाग करते हैं।`,
        `Fewer than 5% of students participate in state and/or national-level competitive examinations.`,
        `5% से 25% विद्यार्थी प्रतिभाग करते हैं और 1-2 बच्चे सफल होते हैं।`,
        `5% to 25% of students participate, and 1-2 children succeed.`,
        `25% से अधिक विद्यार्थी प्रतिभाग करते हैं और 2 से अधिक बच्चे सफल होते हैं।`,
        `More than 25% of students participate, and more than 2 children succeed.`
      ),
    ]),
  ]),

  mkDomain('D5', 'Inclusivity and Community Participation', 'समावेशिता एवं सामुदायिक भागीदारी', 5, 20, [
    mkSub('D5_5.1', 'Inclusion and Special Support', 'समावेशन एवं विशेष समर्थन', 1, [
      mkParam(
        '5.1.1',
        'Supportive arrangements for students with disabilities',
        'दिव्यांग विद्यार्थियों के लिए सहायक व्यवस्थाय़ें',
        1,
        ALL_BANDS,
        `दिव्यांग विद्यार्थियों के लिए सहायक व्यवस्थाएँ अपर्याप्त हैं; विशेष शिक्षक उपलब्ध नहीं हैं और सहायक तकनीक का उपयोग नहीं होता।`,
        `Supportive arrangements for students with disabilities are inadequate; special educators are not available, and assistive technology is not used.`,
        `दिव्यांग विद्यार्थियों के लिए कुछ सहायक व्यवस्थाएँ उपलब्ध हैं; विशेष शिक्षक आंशिक रूप से उपलब्ध हैं और सहायक तकनीक का सीमित उपयोग होता है।`,
        `Some supportive arrangements are available for students with disabilities; special educators are partially available, and assistive technology is used to a limited extent.`,
        `दिव्यांग विद्यार्थियों के लिए समुचित सहायक व्यवस्थाएँ सुनिश्चित हैं; प्रशिक्षित विशेष शिक्षक उपलब्ध हैं और सहायक तकनीक का नियमित एवं प्रभावी उपयोग होता है।`,
        `Adequate supportive arrangements are ensured for students with disabilities; trained special educators are available, and assistive technology is used regularly and effectively.`
      ),
      mkParam(
        '5.1.2',
        'Participation of CWSN in school activities',
        'विद्यालयी गतिविधियों में CWSN की भागीदारी',
        2,
        ALL_BANDS,
        `दिव्यांग बच्चों के लिए योजना और संसाधनों की कमी है; विद्यालयी गतिविधियों में उनकी भागीदारी सीमित रहती है।`,
        `There is a lack of planning and resources for children with disabilities; their participation in school activities remains limited.`,
        `दिव्यांग बच्चे विद्यालयी गतिविधियों में भाग लेते हैं, पर संसाधन और प्रशिक्षित स्टाफ की कमी रहती है।`,
        `Children with disabilities participate in school activities, but there is a shortage of resources and trained staff.`,
        `दिव्यांग बच्चों का पूर्ण समावेश होता है; संसाधन उपलब्ध होते हैं, स्टाफ प्रशिक्षित होता है और सभी बच्चे मिलकर विद्यालयी गतिविधियों व प्रतियोगिताओं में भाग लेते हैं।`,
        `Children with disabilities are fully included; resources are available, staff are trained, and all children participate together in school activities and competitions.`
      ),
      mkParam(
        '5.1.3',
        'Gender equality',
        'लैंगिक समानता',
        3,
        ALL_BANDS,
        `पाठ्येतर एवं सहपाठ्येतर गतिविधियों में विद्यार्थियों की भागीदारी में बड़ी लैंगिक असमानता है। एक लैंगिक वर्ग की प्रतिभागिता अधिक है।`,
        `There is significant gender disparity in student participation in extra-curricular and co-curricular activities. One gender group participates more.`,
        `बराबर भागीदारी के लिए खेल सहित सभी गतिविधियों में बालक बालिकाओं दोनों को प्रतिभाग हेतु प्रोत्साहित करता है।`,
        `For equal participation, both boys and girls are encouraged to take part in all activities, including sports.`,
        `पूर्ण लैंगिक समानता के साथ खेल, कला, नेतृत्व भूमिकाओं में बराबर प्रतिनिधित्व के अवसर मिलते हैं व जेंडर समावेशी प्रथाओं की नियमित रूप से निगरानी की जाती है।`,
        `With full gender equality, equal representation opportunities are available in sports, arts and leadership roles, and gender-inclusive practices are monitored regularly.`
      ),
      mkParam(
        '5.1.4',
        'Developmental opportunities for gifted/talented students',
        'विशिष्ट प्रतिभा वाले विद्यार्थियों हेतु विकासात्मक अवसर',
        4,
        ALL_BANDS,
        `विशिष्ट प्रतिभा वाले विद्यार्थियों के लिए कोई विशेष व्यवस्था नहीं है; उनके विकास के लिए अलग से अवसर उपलब्ध नहीं हैं।`,
        `There is no special arrangement for gifted/talented students; no separate opportunities are available for their development.`,
        `विशिष्ट प्रतिभा वाले विद्यार्थियों के लिए क्लबों और प्रतियोगिताओं के माध्यम से विकास के अवसर प्रदान किए जाते हैं।`,
        `Developmental opportunities are provided for gifted/talented students through clubs and competitions.`,
        `विशिष्ट प्रतिभा वाले विद्यार्थियों के लिए व्यक्तिगत मार्गदर्शन (मेंटरशिप) और नवाचार के लिए विशेष संसाधन उपलब्ध कराए जाते हैं, जिससे उनके समग्र विकास को बढ़ावा मिलता है।`,
        `Individual mentorship and special resources for innovation are provided for gifted/talented students, promoting their overall development.`
      ),
    ]),
    mkSub('D5_5.2', 'Community Participation', 'सामुदायिक भागीदारी', 2, [
      mkParam(
        '5.2.1',
        'Conduct of parent-teacher meetings',
        'अभिभावक-शिक्षक बैठक का आयोजन',
        1,
        ALL_BANDS,
        `अभिभावक-शिक्षक बैठक आयोजित होती है, पर अभिभावकों की भागीदारी 50% से कम रहती है और संवाद सीमित होता है।`,
        `Parent-teacher meetings are held, but parent participation remains below 50%, and dialogue is limited.`,
        `अभिभावक-शिक्षक बैठक में अभिभावकों की भागीदारी 50 से 75% तक होती है; शिक्षकों और अभिभावकों के बीच नियमित संवाद होता है।`,
        `Parent participation in parent-teacher meetings ranges from 50% to 75%; there is regular dialogue between teachers and parents.`,
        `अभिभावक-शिक्षक बैठक में अभिभावकों की व्यापक और सक्रिय भागीदारी (75% से अधिक) होती है; विद्यार्थियों की प्रगति एवं नामांकन इत्यादि पर सार्थक, दो-तरफ़ा और निरंतर संवाद सुनिश्चित होता है।`,
        `There is extensive and active parent participation (more than 75%) in parent-teacher meetings; meaningful, two-way and continuous dialogue on students' progress, enrollment, etc. is ensured.`
      ),
      mkParam(
        '5.2.2',
        'Activeness and effectiveness of the School Management Committee/School Management and Development Committee',
        'विद्यालय प्रबंध समिति/विद्यालय प्रबंधन एवं विकास समिति की सक्रियता एवं प्रभावशीलता',
        2,
        ALL_BANDS,
        `विद्यालय प्रबंधन समिति का गठन हुआ है, पर बैठकें अनियमित होती हैं और निर्णय प्रक्रिया सीमित रहती है।`,
        `The School Management Committee has been formed, but meetings are irregular, and the decision-making process remains limited.`,
        `विद्यालय प्रबंधन समिति की बैठकें नियमित रूप से होती हैं; निर्धारित मुद्दों पर चर्चा और कुछ निर्णय लिए जाते हैं।`,
        `School Management Committee meetings are held regularly; designated issues are discussed, and some decisions are made.`,
        `विद्यालय प्रबंधन समिति की बैठकें पूर्व निर्धारित एजेंडा के अनुसार नियमित (मासिक) रूप से होती हैं; सभी सदस्यों की सहभागिता से निर्णय लिए जाते हैं और विद्यार्थी हित में प्रभावी कार्यवाही सुनिश्चित होती है।`,
        `School Management Committee meetings are held regularly (monthly) as per a predetermined agenda; decisions are made with the participation of all members, and effective action is ensured in the interest of students.`
      ),
      mkParam(
        '5.2.3',
        'Complaint registration and redressal mechanism',
        'शिकायत पंजीकरण एवं निस्तारण तंत्र',
        3,
        ALL_BANDS,
        `शिकायत दर्ज करने की व्यवस्था पर्याप्त नहीं है; शिकायत पेटिका निष्क्रिय है और शिकायतों के निवारण की कोई स्पष्ट एवं व्यवस्थित प्रक्रिया नहीं है।`,
        `The arrangement for lodging complaints is inadequate; the complaint box is inactive, and there is no clear, systematic process for complaint redressal.`,
        `शिकायत दर्ज करने की व्यवस्था उपलब्ध है; शिकायत पेटिका, हेल्पलाइन नंबर और शिकायत निवारण समिति मौजूद है, पर निवारण प्रक्रिया समयबद्ध नहीं है।`,
        `An arrangement for lodging complaints is available; a complaint box, helpline number and grievance redressal committee exist, but the redressal process is not time-bound.`,
        `शिकायत दर्ज और निवारण की सुव्यवस्थित व्यवस्था है; शिकायतें समयबद्ध तरीके से निस्तारित की जाती हैं और अभिभावकों/समुदाय के साथ पारदर्शिता बनाए रखते हुए साझा की जाती हैं।`,
        `There is a well-organized system for complaint registration and redressal; complaints are resolved in a time-bound manner and shared with parents/community while maintaining transparency.`
      ),
      mkParam(
        '5.2.4',
        'Cooperation and availability of resources from external organizations (CSR/NGO)',
        'बाह्य संस्थाओं (CSR/NGO) से सहयोग एवं संसाधनों की उपलब्धता',
        4,
        ALL_BANDS,
        `बाह्य संस्थाओं (CSR/NGO) से सहयोग के लिए कोई व्यवस्थित पहल नहीं है; जुड़ाव सीमित या नहीं के बराबर है।`,
        `There is no systematic initiative to seek cooperation from external organizations (CSR/NGO); engagement is limited or almost non-existent.`,
        `बाह्य संस्थाओं से सहयोग के लिए प्रयास किए जाते हैं; कुछ गतिविधियाँ/सहयोग प्राप्त होते हैं, पर उनका उपयोग आंशिक रहता है।`,
        `Efforts are made to seek cooperation from external organizations; some activities/support are received, but their use remains partial.`,
        `बाह्य संस्थाओं के साथ सक्रिय और योजनाबद्ध साझेदारी है; सहयोग का प्रभावी उपयोग विद्यालय विकास और विद्यार्थियों के सीखने में स्पष्ट रूप से दिखाई देता है।`,
        `There is an active and planned partnership with external organizations; the effective use of this cooperation is clearly visible in school development and student learning.`
      ),
      mkParam(
        '5.2.5',
        'Cultural sensitivity and diversity',
        'सांस्कृतिक संवेदना एवं विविधता',
        5,
        ALL_BANDS,
        `सांस्कृतिक गतिविधियाँ सीमित हैं; स्थानीय समुदाय की भागीदारी बहुत कम या नहीं के बराबर है।`,
        `Cultural activities are limited; local community participation is very low or almost non-existent.`,
        `सांस्कृतिक गतिविधियों में विविधता दिखाई देती है; समुदाय की आंशिक भागीदारी होती है।`,
        `Diversity is visible in cultural activities; there is partial community participation.`,
        `सांस्कृतिक गतिविधियाँ स्थानीय परंपराओं और विविधता से जुड़ी होती हैं; समुदाय की सक्रिय और नियमित भागीदारी सुनिश्चित होती है।`,
        `Cultural activities are connected to local traditions and diversity; active and regular community participation is ensured.`
      ),
      mkParam(
        '5.2.6',
        'Dropout prevention and retention',
        'ड्रॉपआउट रोकथाम एवं ठहराव',
        6,
        ALL_BANDS,
        `ड्रॉपआउट विद्यार्थियों की पहचान होती है; अभिभावक/समुदाय से संपर्क और ठहराव के प्रयास नहीं होते।`,
        `Dropout students are identified; there is no contact with parents/community and no retention efforts.`,
        `पहचान और सूची तैयार होती है; अभिभावकों से संपर्क होता है, पर समुदाय की भागीदारी और ठहराव प्रयास सीमित रहते हैं।`,
        `Identification and listing take place; contact is made with parents, but community involvement and retention efforts remain limited.`,
        `पहचान के साथ अभिभावक व समुदाय से नियमित संपर्क/परामर्श होता है; ठहराव हेतु योजनाबद्ध रणनीतियाँ लागू होती हैं।`,
        `Along with identification, there is regular contact/consultation with parents and community; planned strategies for retention are implemented.`
      ),
    ]),
  ]),
];
