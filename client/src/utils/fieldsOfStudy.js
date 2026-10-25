// Common fields of study with the skills employers look for in each. Used by the profile
// form's field-of-study combobox and to tailor skill suggestions.
import { SKILL_SUGGESTIONS } from './profileOptions.js'

export const FIELDS_OF_STUDY = [
  { name: 'Computer Science', skills: ['Python', 'Java', 'Data Structures & Algorithms', 'SQL', 'Git', 'Web Development', 'Cloud Computing', 'Machine Learning'] },
  { name: 'Information Systems', skills: ['SQL', 'Business Analysis', 'Systems Analysis & Design', 'Python', 'Project Management', 'Tableau', 'Agile/Scrum', 'Web Development'] },
  { name: 'Software Engineering', skills: ['Java', 'JavaScript', 'Git', 'REST APIs', 'Unit Testing', 'CI/CD', 'Agile/Scrum', 'Docker'] },
  { name: 'Computer Engineering', skills: ['C/C++', 'Embedded Systems', 'Python', 'Digital Logic Design', 'Linux', 'Computer Networks', 'Microcontrollers', 'Verilog/VHDL'] },
  { name: 'Data Science & Analytics', skills: ['Python', 'R', 'SQL', 'Machine Learning', 'Data Visualization', 'Statistics', 'Pandas', 'Tableau'] },
  { name: 'Cybersecurity', skills: ['Network Security', 'Penetration Testing', 'Linux', 'Python', 'Cryptography', 'Incident Response', 'SIEM', 'Risk Assessment'] },
  { name: 'Business Administration', skills: ['Project Management', 'Excel', 'Business Analysis', 'Communication', 'Presentation Skills', 'Operations Management', 'Leadership', 'Market Research'] },
  { name: 'Accountancy', skills: ['Financial Reporting', 'Auditing', 'Taxation', 'Excel', 'IFRS', 'Bookkeeping', 'Xero/QuickBooks', 'Financial Analysis'] },
  { name: 'Finance', skills: ['Financial Modelling', 'Excel', 'Valuation', 'Financial Analysis', 'Bloomberg Terminal', 'Risk Management', 'Accounting', 'Portfolio Management'] },
  { name: 'Economics', skills: ['Econometrics', 'Statistics', 'Excel', 'R', 'Stata', 'Data Analysis', 'Economic Research', 'Policy Analysis'] },
  { name: 'Marketing', skills: ['Digital Marketing', 'SEO', 'Social Media Marketing', 'Content Creation', 'Google Analytics', 'Market Research', 'Copywriting', 'Brand Management'] },
  { name: 'Business Analytics', skills: ['SQL', 'Python', 'Excel', 'Tableau', 'Power BI', 'Statistics', 'Data Visualization', 'Business Intelligence'] },
  { name: 'Supply Chain & Logistics', skills: ['Supply Chain Management', 'Inventory Management', 'Procurement', 'Excel', 'SAP', 'Demand Forecasting', 'Operations Management', 'Warehouse Management'] },
  { name: 'Hospitality & Tourism Management', skills: ['Customer Service', 'Event Planning', 'Revenue Management', 'Front Office Operations', 'Food & Beverage Management', 'Communication', 'Multilingual Communication', 'Team Leadership'] },
  { name: 'Law', skills: ['Legal Research', 'Legal Writing', 'Contract Drafting', 'Critical Thinking', 'Negotiation', 'Corporate Law', 'Due Diligence', 'Compliance'] },
  { name: 'Political Science', skills: ['Policy Analysis', 'Research Methods', 'Public Speaking', 'Report Writing', 'Data Analysis', 'Critical Thinking', 'Stakeholder Engagement', 'International Relations'] },
  { name: 'Psychology', skills: ['Research Methods', 'SPSS', 'Statistics', 'Counselling', 'Survey Design', 'Behavioural Analysis', 'Report Writing', 'User Research'] },
  { name: 'Sociology', skills: ['Qualitative Research', 'Survey Design', 'SPSS', 'Data Analysis', 'Report Writing', 'Community Engagement', 'Policy Research', 'Critical Thinking'] },
  { name: 'Communications & Media', skills: ['Content Creation', 'Social Media Management', 'Copywriting', 'Public Relations', 'Video Editing', 'Adobe Creative Suite', 'Storytelling', 'Media Planning'] },
  { name: 'Journalism', skills: ['News Writing', 'Interviewing', 'Editing', 'Fact-Checking', 'Video Editing', 'Social Media', 'Research', 'Storytelling'] },
  { name: 'English Literature', skills: ['Writing', 'Editing & Proofreading', 'Critical Analysis', 'Research', 'Copywriting', 'Content Creation', 'Communication', 'Presentation Skills'] },
  { name: 'History', skills: ['Research', 'Archival Research', 'Writing', 'Critical Analysis', 'Source Evaluation', 'Public Speaking', 'Report Writing', 'Data Analysis'] },
  { name: 'Mechanical Engineering', skills: ['AutoCAD', 'SolidWorks', 'MATLAB', 'Thermodynamics', 'Finite Element Analysis', 'CAD Design', '3D Printing', 'Project Management'] },
  { name: 'Electrical & Electronic Engineering', skills: ['Circuit Design', 'MATLAB', 'PLC Programming', 'Embedded Systems', 'C/C++', 'Power Systems', 'PCB Design', 'Signal Processing'] },
  { name: 'Civil Engineering', skills: ['AutoCAD', 'Structural Analysis', 'Revit', 'Project Management', 'Surveying', 'Construction Management', 'Cost Estimation', 'Site Supervision'] },
  { name: 'Chemical Engineering', skills: ['Process Design', 'Process Simulation', 'MATLAB', 'Thermodynamics', 'Quality Control', 'Safety Management', 'Data Analysis', 'Lab Techniques'] },
  { name: 'Biomedical Engineering', skills: ['Medical Devices', 'MATLAB', 'Biomechanics', 'Signal Processing', 'CAD Design', 'Regulatory Compliance', 'Lab Techniques', 'Python'] },
  { name: 'Architecture', skills: ['AutoCAD', 'Revit', 'SketchUp', 'Rhino', 'Adobe Photoshop', 'Architectural Design', 'Model Making', 'Building Codes'] },
  { name: 'Design (Graphic / UX)', skills: ['Figma', 'Adobe Photoshop', 'Adobe Illustrator', 'Wireframing', 'Prototyping', 'User Research', 'Typography', 'Design Systems'] },
  { name: 'Biology / Life Sciences', skills: ['Lab Techniques', 'PCR', 'Data Analysis', 'Research', 'Microscopy', 'R', 'Scientific Writing', 'Bioinformatics'] },
  { name: 'Chemistry', skills: ['Analytical Chemistry', 'HPLC', 'Spectroscopy', 'Lab Techniques', 'Quality Control', 'Data Analysis', 'Scientific Writing', 'Safety Compliance'] },
  { name: 'Physics', skills: ['Python', 'MATLAB', 'Data Analysis', 'Mathematical Modelling', 'Experimental Design', 'Scientific Writing', 'Statistics', 'Problem Solving'] },
  { name: 'Mathematics', skills: ['Python', 'Statistics', 'Mathematical Modelling', 'R', 'MATLAB', 'Data Analysis', 'Probability', 'Problem Solving'] },
  { name: 'Statistics', skills: ['R', 'Python', 'SQL', 'Statistical Modelling', 'Data Visualization', 'Hypothesis Testing', 'SAS', 'Machine Learning'] },
  { name: 'Nursing', skills: ['Patient Care', 'Clinical Assessment', 'Medication Administration', 'Basic Life Support', 'Health Education', 'Documentation', 'Infection Control', 'Teamwork'] },
  { name: 'Medicine', skills: ['Clinical Assessment', 'Patient Communication', 'Medical Research', 'Diagnosis', 'Basic Life Support', 'Medical Documentation', 'Teamwork', 'Evidence-Based Practice'] },
  { name: 'Pharmacy', skills: ['Pharmacology', 'Dispensing', 'Drug Interactions', 'Patient Counselling', 'Regulatory Compliance', 'Lab Techniques', 'Inventory Management', 'Clinical Research'] },
  { name: 'Environmental Science', skills: ['Environmental Impact Assessment', 'GIS', 'Data Analysis', 'Field Research', 'Sustainability Reporting', 'R', 'Water Quality Testing', 'Report Writing'] },
  { name: 'Education', skills: ['Lesson Planning', 'Classroom Management', 'Curriculum Design', 'Public Speaking', 'Assessment Design', 'Mentoring', 'Educational Technology', 'Communication'] },
]

export const FIELD_OF_STUDY_NAMES = FIELDS_OF_STUDY.map((field) => field.name)

export function findFieldOfStudy(name) {
  const key = String(name ?? '').trim().toLowerCase()
  if (!key) return null
  return FIELDS_OF_STUDY.find((field) => field.name.toLowerCase() === key) ?? null
}

// Skills tailored to the field, or the generic list for empty / custom / unmatched values
export function skillSuggestionsFor(fieldName) {
  return findFieldOfStudy(fieldName)?.skills ?? SKILL_SUGGESTIONS
}
