/**
 * Names for the people who file complaints, drawn from Uttar Pradesh.
 *
 * These replace faker.person.fullName(), which produced Gerard Steuber, Harley
 * Bechtelar and Jaclyn Fay-Spencer — names no parent in Prayagraj is likely to
 * hold, on a page an SSSA officer reads as a picture of who is complaining.
 *
 * Six communities are represented. The pools are kept separate and never mixed
 * across a single name, because a given name and a surname are not independent
 * choices: combining them freely produces people who do not exist.
 *
 * A caution about what this data can and cannot say. The rota below shows every
 * community in a set of two dozen rows, which is what makes the demo look like
 * Uttar Pradesh rather than one part of it. It is NOT the state's religious
 * composition. By the 2011 Census, UP is roughly 79.7% Hindu and 19.3% Muslim,
 * with Sikh, Christian, Jain and Buddhist populations each under half a percent
 * — at that ratio a 26-row table would contain no Sikh, Christian, Jain or
 * Buddhist name at all. Visible representation and proportional representation
 * pull against each other at this sample size, and this file chooses the first.
 * Nobody should read a distribution off this page.
 */

export type Community = 'hindu' | 'muslim' | 'sikh' | 'christian' | 'jain' | 'buddhist';

const NAMES: Record<Community, readonly string[]> = {
  // Surnames common across UP — Awadh, Purvanchal, Bundelkhand and the west.
  hindu: [
    'Ramesh Chandra Tripathi',
    'Sunita Yadav',
    'Awadhesh Kumar Mishra',
    'Shakuntala Verma',
    'Brijesh Kumar Pandey',
    'Neelam Srivastava',
    'Ram Naresh Maurya',
    'Poonam Shukla',
    'Devendra Pratap Singh',
    'Kamla Nishad',
    'Jitendra Kumar Gupta',
    'Rekha Kushwaha',
    'Santosh Kumar Dubey',
    'Usha Rastogi',
    'Yogendra Prasad Chaudhary',
    'Sarita Saxena',
  ],
  muslim: [
    'Mohammad Arif Ansari',
    'Nasreen Siddiqui',
    'Shakeel Ahmad Qureshi',
    'Rukhsana Khan',
    'Irfan Ahmad Idrisi',
    'Farhat Rizvi',
    'Naushad Ali Saifi',
    'Tabassum Ansari',
    'Rizwan Ahmad Khan',
    'Shahnaz Mansoori',
  ],
  // UP's Sikh population is concentrated in the Terai — Pilibhit, Lakhimpur
  // Kheri, Rampur — where families settled after 1947.
  sikh: ['Gurpreet Singh Sethi', 'Harpreet Kaur', 'Jaswant Singh Chawla', 'Manjeet Kaur'],
  // Long-established Christian communities in Prayagraj, Lucknow and Agra.
  christian: ['Sushila Masih', 'Samuel Lall', 'Grace Peter', 'Vijay Massey'],
  // Jain families in Agra, Firozabad and Meerut.
  jain: ['Mahavir Prasad Jain', 'Shobha Jain', 'Praveen Kumar Jain', 'Sudha Jain'],
  // Ambedkarite Buddhists, whose naming reflects the conversion movement.
  buddhist: ['Siddharth Gautam', 'Sujata Bauddh', 'Rahul Kumar Bharti', 'Ashok Prakash Gautam'],
};

/**
 * The order communities are drawn in.
 *
 * Hindu names take every other slot, which keeps the majority visibly the
 * majority; the four smallest communities each appear once per turn of the rota
 * so none of them falls off a short table. Walking this in order rather than
 * picking at random is what guarantees the coverage — random selection weighted
 * by anything close to real proportions leaves minorities out by chance.
 */
const ROTA: readonly Community[] = [
  'hindu', 'muslim',
  'hindu', 'sikh',
  'hindu', 'muslim',
  'hindu', 'christian',
  'hindu', 'muslim',
  'hindu', 'buddhist',
  'hindu', 'muslim',
  'hindu', 'jain',
];

/**
 * The nth name in the rota. Stable for a given n, so a re-run cannot reshuffle
 * who filed what, and consecutive n never repeat a name until a pool is spent.
 */
export function personName(n: number): string {
  const community = ROTA[n % ROTA.length]!;
  // How many earlier slots drew from this same community — that is the index
  // into its pool, so names are used up in order instead of colliding.
  let used = 0;
  for (let i = 0; i < n; i++) if (ROTA[i % ROTA.length] === community) used++;
  const pool = NAMES[community];
  return pool[used % pool.length]!;
}
