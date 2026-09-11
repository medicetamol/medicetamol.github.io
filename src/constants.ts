import type { Exam, Subject } from "./types";

// qid format: {examPrefix}{subjectCode}{serial} — fixed 2+2+3 chars, e.g. PGAN001
export const EXAMS: Array<{ id: Exam; name: string; description: string; prefix: string }> = [
  { id: "NEET-PG", name: "NEET PG", description: "National Eligibility cum Entrance Test", prefix: "PG" },
  { id: "INI-CET", name: "INI-CET", description: "Institute of National Importance", prefix: "IN" },
  { id: "FMGE", name: "FMGE", description: "Foreign Medical Graduate Examination", prefix: "FM" }
];

export const EXAM_PREFIX: Record<Exam, string> = Object.fromEntries(
  EXAMS.map((e) => [e.id, e.prefix])
) as Record<Exam, string>;

export const SUBJECTS: Subject[] = [
  {
    id: "anatomy", name: "Anatomy", code: "AN", short: "Anat",
    topics: [
      { id: "EMB", name: "Embryology" },
      { id: "HIS", name: "Histology" },
      { id: "NEU", name: "Neuroanatomy" },
      { id: "HNK", name: "Head & Neck" },
      { id: "THX", name: "Thorax" },
      { id: "ABP", name: "Abdomen & Pelvis" },
      { id: "UPL", name: "Upper Limb" },
      { id: "LWL", name: "Lower Limb" },
      { id: "OST", name: "Osteology & Joints" },
    ]
  },
  {
    id: "biochemistry", name: "Biochemistry", code: "BC", short: "Biochem",
    topics: [
      { id: "CAR", name: "Carbohydrate" },
      { id: "LIP", name: "Lipids" },
      { id: "PRO", name: "Proteins & Amino Acids" },
      { id: "ENZ", name: "Enzymes" },
      { id: "MOL", name: "Molecular Biology & Genetics" },
      { id: "VIT", name: "Vitamins & Minerals" },
      { id: "MSC", name: "Miscellaneous" },
    ]
  },
  {
    id: "physiology", name: "Physiology", code: "PH", short: "Physio",
    topics: [
      { id: "GNM", name: "General & Nerve Muscle" },
      { id: "CVS", name: "CVS" },
      { id: "RES", name: "Respiratory" },
      { id: "REN", name: "Renal" },
      { id: "GIT", name: "GIT" },
      { id: "ENR", name: "Endocrine & Reproductive" },
      { id: "NPH", name: "Neurophysiology" },
      { id: "HAE", name: "Haematology" },
      { id: "SPS", name: "Special Senses" },
    ]
  },
  {
    id: "pathology", name: "Pathology", code: "PT", short: "Path",
    topics: [
      { id: "CIN", name: "Cell Injury & Adaptation" },
      { id: "INF", name: "Inflammation & Repair" },
      { id: "IMP", name: "Immunopathology" },
      { id: "NEO", name: "Neoplasia" },
      { id: "HAM", name: "Haematopathology" },
      { id: "CVP", name: "CVS" },
      { id: "RSP", name: "Respiratory" },
      { id: "GIP", name: "GIT" },
      { id: "RNP", name: "Renal" },
      { id: "LVR", name: "Liver" },
      { id: "ENP", name: "Endocrine" },
      { id: "RPD", name: "Reproductive" },
      { id: "CNS", name: "CNS" },
      { id: "GNC", name: "Genetics & Paediatric Diseases" },
    ]
  },
  {
    id: "pharmacology", name: "Pharmacology", code: "PM", short: "Pharma",
    topics: [
      { id: "GNP", name: "General" },
      { id: "ANS", name: "ANS" },
      { id: "CNF", name: "CNS" },
      { id: "CVF", name: "CVS" },
      { id: "AUT", name: "Autacoids & NSAIDs" },
      { id: "AMI", name: "Antimicrobials" },
      { id: "ENF", name: "Endocrine" },
      { id: "GRF", name: "GIT & Respiratory" },
      { id: "ACI", name: "Anticancer & Immunomodulators" },
      { id: "ANM", name: "Anaesthesia & Muscle Relaxants" },
    ]
  },
  {
    id: "microbiology", name: "Microbiology", code: "MB", short: "Micro",
    topics: [
      { id: "GEN", name: "General Microbiology" },
      { id: "BAC", name: "Bacteriology" },
      { id: "VIR", name: "Virology" },
      { id: "MYC", name: "Mycology" },
      { id: "PAR", name: "Parasitology" },
      { id: "IMM", name: "Immunology" },
      { id: "CLM", name: "Clinical Microbiology" },
    ]
  },
  {
    id: "community-medicine", name: "Community Medicine", code: "CM", short: "PSM",
    topics: [
      { id: "EPI", name: "Epidemiology & Biostatistics" },
      { id: "CMD", name: "Communicable Diseases" },
      { id: "NCD", name: "Non-Communicable Diseases" },
      { id: "NUT", name: "Nutrition" },
      { id: "ENV", name: "Environment & Health" },
      { id: "FPD", name: "Family Planning & Demography" },
      { id: "NHP", name: "National Health Programmes" },
      { id: "HAD", name: "Health Administration" },
      { id: "VAC", name: "Vaccines & Immunisation" },
      { id: "BMW", name: "Biomedical Waste Management" },
      { id: "INT", name: "International Health" },
    ]
  },
  {
    id: "forensic-medicine", name: "Forensic Medicine", code: "FM", short: "FMT",
    topics: [
      { id: "TRM", name: "Traumatology" },
      { id: "ASP", name: "Asphyxial Deaths" },
      { id: "TOX", name: "Toxicology" },
      { id: "THA", name: "Thanatology & Identification" },
      { id: "JUR", name: "Medical Jurisprudence" },
      { id: "SXO", name: "Sexual Offences & Infant Deaths" },
      { id: "FSP", name: "Forensic Psychiatry" },
    ]
  },
  {
    id: "ophthalmology", name: "Ophthalmology", code: "OP", short: "Ophtha",
    topics: [
      { id: "CJC", name: "Conjunctiva & Cornea" },
      { id: "LNC", name: "Lens & Cataract" },
      { id: "GLC", name: "Glaucoma" },
      { id: "RTV", name: "Retina & Vitreous" },
      { id: "UVO", name: "Uvea & Optic Nerve" },
      { id: "RFQ", name: "Refraction & Squint" },
      { id: "ORL", name: "Orbit, Lids & Lacrimal" },
      { id: "NRO", name: "Neuro-Ophthalmology" },
      { id: "TRM", name: "Trauma & Miscellaneous" },
    ]
  },
  {
    id: "ent", name: "ENT", code: "EN", short: "ENT",
    topics: [
      { id: "EAR", name: "Ear" },
      { id: "NOS", name: "Nose" },
      { id: "PHR", name: "Pharynx" },
      { id: "LRY", name: "Larynx" },
      { id: "INS", name: "Instruments" },
    ]
  },
  {
    id: "medicine", name: "Medicine", code: "GM", short: "Medicine",
    topics: [
      { id: "CAD", name: "Cardiology" },
      { id: "PUL", name: "Pulmonology" },
      { id: "NRL", name: "Neurology" },
      { id: "NEP", name: "Nephrology" },
      { id: "GAS", name: "Gastroenterology & Hepatology" },
      { id: "END", name: "Endocrinology" },
      { id: "HML", name: "Haematology" },
      { id: "IFD", name: "Infectious Diseases" },
      { id: "RHU", name: "Rheumatology & CTD" },
      { id: "EMR", name: "Emergency Medicine" },
      { id: "MSM", name: "Miscellaneous" },
    ]
  },
    {
    id: "surgery", name: "Surgery", code: "GS", short: "Surg",
    topics: [
      { id: "GNS", name: "General" },
      { id: "BRS", name: "Breast" },
      { id: "GIS", name: "GIT" },
      { id: "HBP", name: "Hepatobiliary & Pancreas" },
      { id: "ENS", name: "Endocrine" },
      { id: "URO", name: "Urology" },
      { id: "VAS", name: "Vascular & Cardiothoracic" },
      { id: "HNS", name: "Head & Neck" },
      { id: "NRS", name: "Neurosurgery" },
      { id: "PLB", name: "Plastic Surgery & Burns" },
      { id: "TCC", name: "Trauma & Critical Care" },
      { id: "PDS", name: "Paediatric Surgery" },
    ]
  },
  {
    id: "obstetrics-gynecology", name: "Obstetrics & Gynecology", code: "OG", short: "OBG",
    topics: [
      { id: "NPA", name: "Normal Pregnancy & ANC" },
      { id: "FTP", name: "Fetus & Pelvis" },
      { id: "HRP", name: "High-Risk Pregnancy" },
      { id: "APH", name: "Antepartum Haemorrhage" },
      { id: "GTD", name: "Gestational Trophoblastic Disease" },
      { id: "LBD", name: "Labour & Delivery" },
      { id: "PPP", name: "Postpartum & Puerperium" },
      { id: "MNA", name: "Menstrual Disorders & Amenorrhoea" },
      { id: "IST", name: "Infections & STIs" },
      { id: "FBE", name: "Fibroids & Endometriosis" },
      { id: "PLF", name: "Prolapse & Pelvic Floor" },
      { id: "GYM", name: "Gynaecological Malignancies" },
      { id: "CNT", name: "Contraception" },
      { id: "IFR", name: "Infertility & Reproductive Endocrinology" },
      { id: "IPR", name: "Instruments & Procedures" },
    ]
  },
    {
    id: "pediatrics", name: "Pediatrics", code: "PD", short: "Peds",
    topics: [
      { id: "GRW", name: "Growth & Development" },
      { id: "NEN", name: "Neonatology" },
      { id: "NUM", name: "Nutrition & Malnutrition" },
      { id: "PKI", name: "Infectious Diseases" },
      { id: "PIM", name: "Immunisation" },
      { id: "PCR", name: "Cardiology" },
      { id: "PNR", name: "Neurology" },
      { id: "PHO", name: "Haematology & Oncology" },
      { id: "PRR", name: "Respiratory & Renal" },
      { id: "PEM", name: "Endocrine & Metabolic" },
      { id: "PGS", name: "Genetics & Syndromes" },
    ]
  },
  {
    id: "dermatology", name: "Dermatology", code: "DR", short: "Derma",
    topics: [
      { id: "PAP", name: "Papulosquamous" },
      { id: "BKI", name: "Bacterial Infections" },
      { id: "FVI", name: "Fungal & Viral Infections" },
      { id: "STI", name: "STIs" },
      { id: "BLA", name: "Blistering & Autoimmune" },
      { id: "PGH", name: "Pigmentary & Hair Disorders" },
      { id: "SKT", name: "Skin Tumours" },
      { id: "MSD", name: "Miscellaneous" },
    ]
  },
  {
    id: "psychiatry", name: "Psychiatry", code: "PS", short: "Psych",
    topics: [
      { id: "SCH", name: "Schizophrenia & Psychosis" },
      { id: "MOD", name: "Mood Disorders" },
      { id: "ANX", name: "Anxiety & Neurotic Disorders" },
      { id: "SUB", name: "Substance Use" },
      { id: "PRS", name: "Personality Disorders" },
      { id: "ORG", name: "Organic Mental Disorders" },
      { id: "CHP", name: "Child Psychiatry" },
      { id: "PSF", name: "Psychopharmacology" },
      { id: "SSE", name: "Sleep, Sexual & Eating Disorders" },
      { id: "FOP", name: "Forensic Psychiatry" },
    ]
  },
  {
    id: "orthopedics", name: "Orthopedics", code: "OR", short: "Ortho",
    topics: [
      { id: "FRG", name: "Fractures — General" },
      { id: "FUL", name: "Upper Limb Fractures" },
      { id: "FLL", name: "Lower Limb Fractures" },
      { id: "SPN", name: "Spine" },
      { id: "BJI", name: "Bone & Joint Infections" },
      { id: "BNT", name: "Bone Tumours" },
      { id: "ARJ", name: "Arthritis & Joint Disorders" },
      { id: "PDO", name: "Paediatric Orthopaedics" },
      { id: "NMM", name: "Neuromuscular & Metabolic" },
    ]
  },
  {
    id: "anesthesiology", name: "Anesthesiology", code: "AS", short: "Anes",
    topics: [
      { id: "AGL", name: "General Principles & Pre-op Assessment" },
      { id: "AAW", name: "Airway Management" },
      { id: "AIV", name: "Inhalational & IV Agents" },
      { id: "AOP", name: "NMBs & Opioids" },
      { id: "ARG", name: "Regional & Neuraxial Anaesthesia" },
      { id: "AMM", name: "Monitoring & Machines" },
      { id: "AVC", name: "Ventilation & ICU" },
      { id: "APC", name: "Pain & Post-op Care" },
    ]
  },
  {
    id: "radiology", name: "Radiology", code: "RD", short: "Radio",
    topics: [
      { id: "RDB", name: "Basics" },
      { id: "RDG", name: "GIT" },
      { id: "RDR", name: "Respiratory" },
      { id: "RDC", name: "CVS" },
      { id: "RDN", name: "Neuroradiology" },
      { id: "RDM", name: "Musculoskeletal" },
      { id: "RDW", name: "Genitourinary & Women's Imaging" },
      { id: "RDI", name: "Interventional & Nuclear Medicine" },
      { id: "RDT", name: "Radiotherapy" },
    ]
  }
];

export const getSubject = (id: string) => SUBJECTS.find((s) => s.id === id);
export const getTopic = (subjectId: string, topicId: string) =>
  SUBJECTS.find((s) => s.id === subjectId)?.topics.find((t) => t.id === topicId);