const LEVEL_CARDS = [
  {
    name: 'Uday',
    score: 'Upto 55%',
    desc: 'Needs improvement',
    bg: 'bg-[#FCE7F3]',
  },
  {
    name: 'Unnat',
    score: '55% to 80%',
    desc: 'Performing satisfactorily',
    bg: 'bg-[#FEF9C3]',
  },
  {
    name: 'Utkarsh',
    score: 'Above 80%',
    desc: 'Exemplary performance',
    bg: 'bg-[#DCFCE7]',
  },
] as const;

const DOMAINS = [
  {
    title: '🏫 Infrastructure and Safety',
    text: 'Physical facilities, classrooms, labs, safety measures, drinking water, toilets, and boundary walls.',
  },
  {
    title: '👥 Administration, HR and Leadership',
    text: 'School governance, leadership planning, teacher adequacy, professional development, and HR management.',
  },
  {
    title: '📚 Teaching and Learning',
    text: 'How well the school plans and delivers lessons, uses teaching aids, and implements the curriculum.',
  },
  {
    title: '📊 Assessment and Learning Outcomes',
    text: 'How schools assess students, track learning outcomes, and use data to improve teaching and results.',
  },
  {
    title: '🤝 Inclusiveness and Community Engagement',
    text: 'Ensuring all children have equal access, addressing dropout, promoting health, and engaging parents and community.',
  },
] as const;

const ASSESSMENT_STEPS = [
  {
    step: 1,
    title: 'Self Reporting',
    text: 'Schools complete a self-assessment across all 5 UP-SQAAF domains, selecting their level for each indicator and providing evidence.',
  },
  {
    step: 2,
    title: 'External Evaluation',
    text: 'Trained external evaluators visit the school, review the self-assessment, and provide independent ratings for each indicator.',
  },
  {
    step: 3,
    title: 'Scoring & Levels',
    text: 'Domain scores are computed using defined weightages. Schools are classified as Uday (upto 55%), Unnat (55% to 80%), or Utkarsh (above 80%) based on overall performance.',
  },
] as const;

function ContentCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-semibold text-[#1B2A6B]">{title}</h2>
      <div className="mt-4 text-gray-600 leading-relaxed">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="bg-[#F3F4F6]">
      <section className="bg-[#1B2A6B] px-4 py-12 text-white sm:py-14">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-2xl font-bold sm:text-3xl">
            About State School Standard Authority, Uttar Pradesh
          </h1>
          <p className="mt-2 text-lg text-white/90">
            State School Standard Authority, Uttar Pradesh
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <ContentCard title="What is the State School Standard Authority, Uttar Pradesh?">
          <p>
            The State School Standard Authority, Uttar Pradesh is an independent regulatory
            body established to set, monitor, and enforce quality standards for all
            government and aided schools across the state. It functions as the standards
            and accreditation authority, ensuring transparent quality benchmarks and public
            accountability in school education.
          </p>
        </ContentCard>

        <ContentCard title="What is NEP 2020?">
          <p>
            The National Education Policy 2020 is India&apos;s comprehensive education reform
            framework. NEP 2020 mandates that every state establish an independent state
            school standards authority to ensure school quality through a transparent
            regulatory approach — setting clear minimum standards while encouraging school
            autonomy and improvement.
          </p>
        </ContentCard>

        <ContentCard title="What is the Uttar Pradesh School Quality Assessment and Accreditation Framework?">
          <p>
            The Uttar Pradesh School Quality Assessment and Accreditation Framework is the
            primary assessment tool used by the Authority. It evaluates schools across 5
            quality domains using a structured scoring methodology.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {LEVEL_CARDS.map((card) => (
              <div key={card.name} className={`rounded-xl p-4 ${card.bg}`}>
                <p className="font-bold text-[#1B2A6B]">{card.name}</p>
                <p className="mt-1 text-sm font-medium text-gray-700">{card.score}</p>
                <p className="mt-2 text-sm text-gray-600">{card.desc}</p>
              </div>
            ))}
          </div>
        </ContentCard>

        <ContentCard title="The 5 Quality Domains">
          <div className="grid gap-4 sm:grid-cols-2">
            {DOMAINS.slice(0, 4).map((d) => (
              <div
                key={d.title}
                className="rounded-lg border border-gray-100 bg-gray-50 p-4"
              >
                <p className="font-semibold text-[#1B2A6B]">{d.title}</p>
                <p className="mt-2 text-sm text-gray-600">{d.text}</p>
              </div>
            ))}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 sm:col-span-2 sm:mx-auto sm:max-w-lg">
              <p className="font-semibold text-[#1B2A6B]">{DOMAINS[4].title}</p>
              <p className="mt-2 text-sm text-gray-600">{DOMAINS[4].text}</p>
            </div>
          </div>
        </ContentCard>

        <ContentCard title="How Assessment Works">
          <div className="grid gap-6 sm:grid-cols-3">
            {ASSESSMENT_STEPS.map((item) => (
              <div key={item.step} className="text-center sm:text-left">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#1B2A6B] text-sm font-bold text-white sm:mx-0">
                  {item.step}
                </div>
                <p className="mt-3 font-semibold text-[#1B2A6B]">{item.title}</p>
                <p className="mt-2 text-sm text-gray-600">{item.text}</p>
              </div>
            ))}
          </div>
        </ContentCard>
      </div>

      <footer className="bg-[#1B2A6B] py-6 text-center text-sm text-white/90">
        <p>
          © 2025 State School Standards Authority, Uttar Pradesh. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
