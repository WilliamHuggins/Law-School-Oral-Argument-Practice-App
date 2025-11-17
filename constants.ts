
import { CaseCategory } from './types';

export const STANFORD_RED = '#8C1515';
export const STANFORD_CHARCOAL = '#231F20';
export const STANFORD_GREEN = '#175E54';

export const CASE_LIBRARY: CaseCategory[] = [
  {
    name: 'Criminal Law',
    cases: [
      {
        title: 'Miranda v. Arizona (1966)',
        category: 'Criminal Law',
        summary: 'Suspects must be informed of their constitutional rights, including the right to remain silent and the right to an attorney, before custodial interrogation. Statements made without these warnings are inadmissible in court.',
      },
    ],
  },
  {
    name: 'Constitutional Law',
    cases: [
      {
        title: 'Brown v. Board of Education (1954)',
        category: 'Constitutional Law',
        summary: 'The Supreme Court ruled that state-sponsored segregation in public schools is unconstitutional under the Equal Protection Clause of the Fourteenth Amendment, overturning the "separate but equal" doctrine.',
      },
    ],
  },
  {
    name: 'Administrative & Regulatory Law',
    cases: [
      {
        title: 'Chevron U.S.A., Inc. v. NRDC (1984)',
        category: 'Administrative & Regulatory Law',
        summary: 'This case established the "Chevron deference," a principle of administrative law requiring courts to defer to a federal agency\'s reasonable interpretation of an ambiguous statute that it administers.',
      },
    ],
  },
  {
    name: 'Corporate/Commercial Law',
    cases: [
      {
        title: 'Dodge v. Ford Motor Co. (1919)',
        category: 'Corporate/Commercial Law',
        summary: 'A landmark case holding that a for-profit corporation\'s primary purpose is to maximize shareholder profits. The court ordered Ford to pay dividends instead of withholding them for business expansion and employee benefits.',
      },
    ],
  },
  {
    name: 'Intellectual Property Law',
    cases: [
      {
        title: 'Sony Corp. of America v. Universal City Studios (1984)',
        category: 'Intellectual Property Law',
        summary: 'The Supreme Court held that making individual copies of complete television shows for personal, non-commercial time-shifting purposes is fair use, and that manufacturers of home video recording devices (like Sony\'s Betamax) were not liable for contributory copyright infringement.',
      },
    ],
  },
];
