"""
The situations a practitioner can ask about, in the words they actually use.

Why this exists. The statutes are written in words a vaid or a small Ayurvedic
business does not use. Section 7 of the Biological Diversity Act speaks of a
"body corporate" obtaining a "biological resource for commercial utilization";
the person asks "I use Indian plants for my company, any rule?". Search cannot
bridge that gap: for that question the cross-encoder scored every provision in
the corpus below 0.02 and Section 7 was not retrieved at all. The model then
cited provisions it had never been shown and the answer was refused. Written in
the statute's own terms, the same question retrieves Section 7 first and is
answered with high confidence.

So a question is first mapped to one of these situations, and the missing facts
that change which law applies are asked for, one tap at a time. Once they are
known, the question is restated in the statute's terms and searched topic by
topic. This is a closed list on purpose: a question can only ever be mapped to a
situation written here, never to a legal question someone's wording invented.

What is and is not authoritative here:
  - "explain" and "why" are plain-language orientation written from the
    verbatim provisions in knowledge-base/corpus/india.json. They name no
    section numbers. Citations still come only from verified retrieval.
  - "examples" are phrasings used to recognise the situation. They are not a
    test set; the held-out phrasings live in evaluators/layman_intents.json.
  - "retrieval_queries" reuse each target provision's retrieval_context, so one
    search finds one provision (see RAGOrchestrator._routed_evidence).
"""

from typing import Any, Dict, List

# Shared option for "I don't know". Choosing it never blocks an answer: the
# question is restated to cover every branch, and every branch is searched.
NOT_SURE_KEYWORDS = [
    r"\bnot sure\b", r"\bdon'?t know\b", r"\bdo not know\b", r"\bno idea\b",
    r"\bunsure\b", r"\bnot certain\b", r"\bcan'?t say\b", r"\bdunno\b", r"\bpata nahi\b",
]

# "Our company is from Germany", "a UK-based firm", "an American company". Tied
# to the business itself: "I buy turmeric from Nepal" says where the plant came
# from, not who the buyer is.
_COUNTRIES = r"(germany|usa|us|uk|america|china|japan|france|europe|canada|australia|singapore|uae|dubai|korea|italy|spain|netherlands|switzerland|russia|brazil|nepal|sri lanka|bangladesh)"
_NATIONALITIES = r"(german|american|us|uk|british|chinese|japanese|french|european|canadian|australian|korean|italian|dutch|swiss)"
FOREIGN_BASED = (
    rf"\b(company|firm|business|startup|organi[sz]ation|we are|we're|i am|i'm)\b[^.?!]{{0,20}}"
    rf"\b(from|based in|registered in|incorporated in) {_COUNTRIES}\b"
    rf"|\b{_COUNTRIES}[- ]based\b|\b(an? )?{_NATIONALITIES} (company|firm|business|startup|brand)\b"
)

# "A small firm in Kerala", "we are based in Pune": the business is located in
# India. Tied to the business, like FOREIGN_BASED: "a foreign company using
# plants in India" says where the plants are used, not where the company is.
INDIA_BASED = (
    r"\b(company|firm|business|shop|startup|unit|factory|organi[sz]ation|we are|we're|i am|i'm)\b[^.?!]{0,20}"
    r"\b(in|from|based in|registered in|at) (india|andhra pradesh|telangana|kerala|karnataka|tamil nadu|maharashtra|gujarat|"
    r"rajasthan|punjab|haryana|uttar pradesh|uttarakhand|himachal pradesh|madhya pradesh|chhattisgarh|bihar|jharkhand|"
    r"odisha|orissa|west bengal|assam|goa|delhi|hyderabad|bengaluru|bangalore|chennai|mumbai|pune|kolkata|ahmedabad|"
    r"jaipur|lucknow|bhopal|patna|bhubaneswar|kochi|coimbatore|vijayawada|visakhapatnam|nagpur|indore|surat|haridwar)\b"
)

# Retrieval strings, copied from the target chunk's retrieval_context.
R_SEC3_FOREIGN = "foreign company non-resident NRI overseas entity needs National Biodiversity Authority NBA approval to access Indian plants biological resources research commercial use"
R_SEC4_RESULTS = "transfer research results on Indian biological resources to foreign person NBA approval"
R_SEC6_2002 = "NBA approval before applying for a patent or intellectual property using Indian biological resource benefit sharing fee royalty"
R_SEC6_2023 = "NBA approval before grant of patent intellectual property Indian biological resource traditional knowledge registration benefit sharing commercialisation 2023 amendment timing"
R_SEC7 = "Indian company prior intimation to State Biodiversity Board SBB commercial utilisation exemption for vaids hakims growers cultivators local communities"
R_SEC7_2023 = "exemption for registered AYUSH practitioners vaids hakims cultivated medicinal plants codified traditional knowledge certificate of origin Biodiversity Management Committee do ABS obligations apply to me ashwagandha grower"
R_PAT_INVENTION = "definition of invention novelty inventive step industrial application what counts as an invention patentable"
R_PAT_3D = "patent new form of a known substance enhanced efficacy derivatives salts polymorphs particle size nano herbal reformulated classical preparation evergreening"
R_PAT_3E = "patent mere admixture combining two or more herbs polyherbal combination blend new ratio of classical herbs synergy synergistic efficacy mixture of known ingredients"
R_PAT_3P = "patent traditional knowledge cannot be patented classical Ayurvedic formulation Charaka Samhita Sushruta Ashtanga Hridaya classical texts patentability bar for traditional medicine Ayurveda TKDL prior art"
R_PAT_10_4 = "patent specification disclose source and geographical origin of biological material Indian plant used in invention disclosure requirement"
R_PAT_25 = "pre-grant opposition oppose a patent application non-disclosure of biological source anticipation by local or indigenous community knowledge stop a patent"
R_PAT_64 = "revoke a patent post-grant revocation High Court stop a foreign company patenting a formulation from our tradition biopiracy indigenous knowledge"
R_DC_3A = "what is a classical Ayurvedic drug ASU Ayurvedic Siddha Unani drug definition manufactured exclusively per formulae in authoritative books First Schedule"
R_DC_3H = "patent or proprietary medicine P or P definition difference between classical Ayurvedic drug and proprietary medicine new combination not in classical texts licensing"
R_DC_FIRST_SCHEDULE = "authoritative books list which classical texts count Charaka Samhita Sushruta Samhita Ashtanga Hridaya Bhava Prakasha Sharangadhara Ayurvedic Formulary of India first schedule books"
R_DC_158B = "licence categories for Ayurvedic Siddha Unani drugs safety study evidence of effectiveness published literature proof licensing requirements classical versus proprietary medicine"
R_AAHARA = "Ayurveda Aahara definition sell as food not a drug nutraceutical health supplement FSSAI food licence no therapeutic claim"
R_TM_9 = "trademark absolute grounds refusal descriptive mark generic name customary in trade can I trademark my Ayurvedic product name brand distinctive character acquired distinctiveness"
R_DMR_3 = "advertising restrictions cannot advertise cure for diabetes prohibited disease claims magic remedies misleading advertisement marketing claims"
R_GI = "geographical indication GI definition region specific product GI tag for Ayurvedic preparation origin quality reputation attributable to geographical origin"
R_PHYTO = "phytopharmaceutical drug definition purified standardised fraction four bioactive phytochemical markers extract of medicinal plant what evidence do I need clinical"


def _not_sure(fact: str, retrieval_queries: List[str]) -> Dict[str, Any]:
    return {
        "value": "not_sure",
        "label": "I'm not sure",
        "fact": fact,
        "keywords": NOT_SURE_KEYWORDS,
        "retrieval_queries": retrieval_queries,
    }


INTENTS: List[Dict[str, Any]] = [
    # ------------------------------------------------------------------
    {
        "id": "plants_in_business",
        "title": "Rules for using Indian plants or herbs in a business",
        # Words that, when present, point to this situation. They add a small
        # fixed amount to the similarity score (intent_mapper.CUE_BOOST); they
        # never decide a match on their own.
        "cues": [r"\bbusiness\b", r"\bcompan(y|ies)\b", r"\bfirm\b", r"\bcommerciali[sz]", r"\bcommercial(ly)?\b", r"\bsell(ing)?\b", r"\bbiodiversity\b",
                 r"\babs\b", r"\bbenefit[- ]sharing\b", r"\bstart-?ups?\b", r"\bmsmes?\b"],
        "explain": (
            "Plants, herbs and their parts are what the law calls **biological resources**. Using them in a "
            "business can mean informing your State Biodiversity Board in advance (called **prior intimation**) "
            "or getting approval from the National Biodiversity Authority, and some people are exempt. Which of "
            "these applies depends on who you are and where the plants come from."
        ),
        "ask": (
            "Which biodiversity rules apply to me for using Indian medicinal plants commercially: do I need "
            "approval or must I give prior intimation, do any exemptions apply, and what benefit sharing "
            "obligations apply?"
        ),
        "retrieval_queries": [],
        "slots": [
            {
                "name": "who",
                "question": "Who is using the plants?",
                "why": (
                    "An Indian business informs the State Biodiversity Board, while a foreign company or a "
                    "non-resident needs approval from the National Biodiversity Authority. Vaids, hakims, "
                    "registered AYUSH practitioners, growers and local communities can be exempt."
                ),
                "options": [
                    {
                        "value": "indian_business",
                        "label": "An Indian company, firm or shop",
                        "fact": "I run a business registered in India.",
                        "keywords": [
                            # One word may sit in between: "Indian ASU startups", "Indian herbal company".
                            r"\bindian (\w+ )?(compan(y|ies)|firms?|business(es)?|start-?ups?|brands?|manufacturers?|"
                            r"entrepreneurs?|citizens?|nationals?|shops?|msmes?)\b",
                            r"\b(registered|incorporated|based) in india\b", r"\bi am (an )?indian\b",
                            r"\b(pvt|private limited|llp|proprietorship|proprietor|msme)\b", INDIA_BASED,
                        ],
                        "retrieval_queries": [R_SEC7, R_SEC7_2023],
                    },
                    {
                        "value": "foreign",
                        "label": "A foreign company or an NRI",
                        "fact": "I am a foreign company or a non-resident, or my company has foreign ownership.",
                        "keywords": [
                            r"\bforeign\b", r"\bnri\b", r"\bnon[- ]?resident", r"\boverseas\b", r"\bmultinational\b",
                            r"\boutside india\b", r"\bnot (an )?indian\b", r"\bforeigner\b", FOREIGN_BASED,
                        ],
                        "retrieval_queries": [R_SEC3_FOREIGN],
                    },
                    {
                        "value": "practitioner",
                        "label": "A vaid, hakim or AYUSH practitioner",
                        "fact": "I am a vaid or registered AYUSH practitioner practising Indian systems of medicine for my livelihood.",
                        "keywords": [
                            r"\bvaid(ya)?s?\b", r"\bhakims?\b", r"\bayush practitioner", r"\bpractitioner\b",
                            r"\bayurvedic doctor\b", r"\bbams\b",
                        ],
                        "retrieval_queries": [R_SEC7_2023, R_SEC7],
                    },
                    {
                        "value": "grower",
                        "label": "A farmer, grower or local community",
                        "fact": "I am a grower or cultivator of medicinal plants, or part of the local community where they grow.",
                        "keywords": [
                            r"\bfarmers?\b", r"\bgrowers?\b", r"\bcultivators?\b", r"\bi (grow|cultivate|farm)\b",
                            r"\btribal\b", r"\blocal communit",
                        ],
                        "retrieval_queries": [R_SEC7_2023, R_SEC7],
                    },
                    _not_sure("", [R_SEC7, R_SEC3_FOREIGN, R_SEC7_2023]),
                ],
            },
            {
                "name": "source",
                # Only an Indian business turns on this. The exemption for
                # cultivated medicinal plants is an exemption from prior
                # intimation, which only Indian persons give.
                "required_if": {"who": ["indian_business", "not_sure"]},
                "question": "Where do the plants come from?",
                "why": (
                    "Since the 2023 amendment, cultivated medicinal plants can be exempt from prior intimation, "
                    "but only with a certificate of origin from the local Biodiversity Management Committee."
                ),
                "options": [
                    {
                        "value": "cultivated",
                        "label": "Grown on farms (cultivated)",
                        "fact": "The plants I use are cultivated medicinal plants.",
                        "keywords": [
                            r"\bcultivat", r"\bfarm[- ]?grown\b", r"\bgrown on (a |my |our )?farms?\b",
                            r"\bplantation\b", r"\bi grow\b", r"\bwe grow\b", r"\bgrow (them|it) (myself|ourselves)\b",
                        ],
                        "retrieval_queries": [R_SEC7_2023],
                    },
                    {
                        "value": "wild",
                        "label": "Collected from forests or the wild",
                        "fact": "The plants I use are collected from the wild or from forests.",
                        "keywords": [r"\bwild\b", r"\bforests?\b", r"\bjungles?\b", r"\bcollected from\b"],
                        "retrieval_queries": [R_SEC7],
                    },
                    _not_sure(
                        "I do not know whether the plants I use are cultivated or collected from the wild.",
                        [R_SEC7, R_SEC7_2023],
                    ),
                ],
            },
        ],
        # Never add the benchmark's questions (evaluators/golden_dataset.json)
        # or the held-out set's (evaluators/layman_intents.json) here. Both
        # measure recognition of phrasings the system has not seen.
        "examples": [
            "Do I need permission to use herbs in my company products?",
            "my company makes products from plants, what law applies",
            "I want to start a herbal products business, any government permission for plants",
            "I buy neem and tulsi to make and sell products. Any rule?",
            "is it legal to sell products made from Indian herbs",
            "using ashwagandha commercially what approvals are needed",
            "my firm processes medicinal herbs into oils, is there a law about the herbs",
            "Must a company registered in India inform the State Biodiversity Board before sourcing a biological resource for commercial utilisation?",
            "Do access and benefit sharing obligations apply to my herbal business?",
            "a foreign company wants to use Indian medicinal plants, what approval do they need",
            "are vaids exempt from biodiversity rules when using plants",
            "does a farmer growing medicinal plants need any biodiversity permission",
            "herbal company raw material from forest, any biodiversity rules",
            "benefit sharing fee for using plants in products",
        ],
    },
    # ------------------------------------------------------------------
    {
        "id": "patent_my_product",
        "title": "Getting a patent on my Ayurvedic product",
        "cues": [r"\bpatent", r"\binvent", r"\bown the rights\b", r"\bcopying\b"],
        "explain": (
            "Indian patent law does not count everything new-looking as an **invention**. Traditional knowledge, "
            "a simple mixture of known herbs, and a new form of a known substance that works no better are all "
            "excluded. What your product is based on decides which of these applies to you."
        ),
        "ask": "Can I get a patent on this product in India, and what could stop it being patentable?",
        "retrieval_queries": [R_PAT_INVENTION],
        "slots": [
            {
                "name": "basis",
                "question": "What is your product based on?",
                "why": (
                    "A recipe from a classical text is treated as traditional knowledge, a new mix of known herbs is "
                    "tested as a possible mere admixture, and an extract or new form must show better effectiveness. "
                    "Each is a different test."
                ),
                "options": [
                    {
                        "value": "classical",
                        "label": "A recipe from a classical Ayurvedic text",
                        "fact": "My product is a formulation taken from a classical Ayurvedic text.",
                        "keywords": [
                            r"\bclassical\b", r"\bcharaka\b", r"\bsushruta\b", r"\bsamhita\b", r"\bancient (text|book|recipe)",
                            r"\bold (text|book|scripture)", r"\btraditional recipe\b", r"\bgrand(mother|father)'?s? (recipe|remedy)",
                        ],
                        "retrieval_queries": [R_PAT_3P],
                    },
                    {
                        "value": "combination",
                        "label": "My own mix or new ratio of known herbs",
                        "fact": "My product is my own combination of known herbs in a new ratio.",
                        "keywords": [
                            r"\b(combin|mix|blend)\w*\b.*\bherbs?\b", r"\bherbs?\b.*\b(combin|mix|blend)\w*\b",
                            r"\bnew ratio\b", r"\bpolyherbal\b", r"\bmy own (formula|formulation|mix|blend)\b",
                        ],
                        "retrieval_queries": [R_PAT_3E, R_PAT_3P],
                    },
                    {
                        "value": "extract",
                        "label": "A purified or standardised plant extract",
                        "fact": "My product is a purified or standardised extract of a medicinal plant.",
                        "keywords": [r"\bextract", r"\bstandardi[sz]ed\b", r"\bpurified\b", r"\bfraction\b", r"\bmarker compound"],
                        "retrieval_queries": [R_PAT_3D],
                    },
                    {
                        "value": "new_form",
                        "label": "A new form or new use of a known herb",
                        "fact": "My product is a new form, or a new use, of a known herb or medicine.",
                        "keywords": [r"\bnew (form|use|dosage form)\b", r"\bnano\b", r"\b(tablet|capsule) form\b", r"\breformulat"],
                        "retrieval_queries": [R_PAT_3D],
                    },
                    _not_sure("", [R_PAT_3P, R_PAT_3E, R_PAT_3D]),
                ],
            },
        ],
        "examples": [
            "can I patent my ayurvedic medicine",
            "I made a new herbal medicine, can I get a patent so nobody copies it",
            "how do I patent my herbal formula",
            "my product is new, can I protect it with a patent",
            "Is a formulation described in a First Schedule text patentable under the Patents Act?",
            "does a blend of known herbs count as an invention",
            "is my grandmother's remedy patentable",
            "can I get patent on a herbal powder I invented",
            "is a new nano form of turmeric patentable",
            "will the patent office accept a traditional Ayurvedic preparation",
        ],
    },
    # ------------------------------------------------------------------
    {
        "id": "patent_using_indian_plant",
        "title": "Permissions before patenting something made from Indian plants",
        "cues": [r"\bpatent.*\b(approval|permission|nba|disclos|mention|origin|where)\b", r"\b(approval|permission|nba)\b.*\bpatent"],
        "explain": (
            "When an invention is based on a plant or other **biological resource** from India, the patent process "
            "is linked to the National Biodiversity Authority, and the patent application must state the source "
            "and geographical origin of the plant material."
        ),
        "ask": (
            "What must I do with the National Biodiversity Authority before my patent on an invention using an "
            "Indian plant is granted, and what must the patent application disclose about the plant's origin?"
        ),
        "retrieval_queries": [R_SEC6_2023, R_PAT_10_4],
        "slots": [
            {
                "name": "applicant",
                "question": "Who is applying for the patent?",
                "why": (
                    "Since the 2023 amendment, Indian applicants register with the National Biodiversity Authority "
                    "before the patent is granted, while foreign applicants need its prior approval."
                ),
                "options": [
                    {
                        "value": "indian",
                        "label": "An Indian citizen or company",
                        "fact": "I am an Indian citizen or a company registered in India.",
                        "keywords": [
                            r"\bindian (company|firm|citizen|national|startup|applicant|inventor)\b",
                            r"\b(registered|incorporated|based) in india\b", r"\bi am (an )?indian\b", INDIA_BASED,
                        ],
                        "retrieval_queries": [],
                    },
                    {
                        "value": "foreign",
                        "label": "A foreign company or an NRI",
                        "fact": "I am a foreign applicant, a non-resident, or a company with foreign ownership.",
                        "keywords": [r"\bforeign\b", r"\bnri\b", r"\bnon[- ]?resident", r"\boverseas\b", r"\bforeigner\b", FOREIGN_BASED],
                        "retrieval_queries": [R_SEC3_FOREIGN],
                    },
                    _not_sure("", [R_SEC6_2002]),
                ],
            },
        ],
        "examples": [
            "do I need government permission before patenting a medicine made from Indian herbs",
            "patent using neem, any approval needed first",
            "must the patent specification state the source of the biological material used",
            "do I need to mention where I got the plant in my patent application",
            "NBA approval for patent on herbal invention",
            "before filing patent on plant based product who should I ask permission",
        ],
    },
    # ------------------------------------------------------------------
    {
        "id": "medicine_licence",
        "title": "Licence to make and sell an Ayurvedic medicine",
        "cues": [r"\blicen[cs]", r"\bmanufactur", r"\bas (a )?medicine\b", r"\bdawai\b"],
        "explain": (
            "For licensing, an Ayurvedic medicine made exactly to a formula in one of the classical books listed in "
            "the **First Schedule** is a different category from your own formulation that only uses ingredients "
            "from those books, which is called a **patent or proprietary medicine**. The evidence of safety and "
            "effectiveness you need depends on the category."
        ),
        "ask": "Which licence category applies to my Ayurvedic medicine, and what safety or effectiveness evidence do I need for it?",
        "retrieval_queries": [R_DC_158B],
        "slots": [
            {
                "name": "formula",
                "question": "Is your medicine made exactly to a formula from a classical text?",
                "why": (
                    "A classical formula and your own formula are licensed under different categories with "
                    "different evidence requirements."
                ),
                "options": [
                    {
                        "value": "classical",
                        "label": "Yes, exactly as in a classical text",
                        "fact": "My medicine is made exactly to a formula from a classical Ayurvedic text.",
                        "keywords": [r"\bclassical\b", r"\bcharaka\b", r"\bsushruta\b", r"\bsamhita\b", r"\bexactly as\b", r"\bfirst schedule\b"],
                        "retrieval_queries": [R_DC_3A, R_DC_FIRST_SCHEDULE],
                    },
                    {
                        "value": "own_formula",
                        "label": "No, it is my own formula",
                        "fact": "My medicine is my own formulation using herbs mentioned in classical texts.",
                        "keywords": [
                            r"\bmy own\b", r"\bproprietary\b", r"\bnew combination\b",
                            r"\bnot (in|from) (any |the )?(old |classical |ancient )?(book|text)s?\b",
                        ],
                        "retrieval_queries": [R_DC_3H],
                    },
                    _not_sure("", [R_DC_3A, R_DC_3H]),
                ],
            },
        ],
        "examples": [
            "what licence do I need to make ayurvedic medicine",
            "I want to sell my ayurvedic tablets, what permission is needed",
            "how to start manufacturing ayurvedic medicines legally",
            "which licence category covers a classical Ayurvedic drug versus a proprietary one",
            "is my herbal syrup a classical medicine or proprietary medicine",
            "license for ayurvedic medicine factory",
            "what proof of safety do I need to get a licence for my ayurvedic product",
        ],
    },
    # ------------------------------------------------------------------
    {
        "id": "sell_as_food",
        "title": "Selling it as a food or health supplement",
        "cues": [r"\bfood\b", r"\bdrink\b", r"\bsupplement", r"\bnutraceutical", r"\baahara\b", r"\bfssai\b", r"\bsnack\b", r"\bbar\b"],
        "explain": (
            "A product can be sold as **Ayurveda Aahara**, a food made to recipes or processes from authoritative "
            "Ayurvedic books, instead of as a medicine. It then falls under food regulation, and it cannot include "
            "things such as Ayurvedic drugs, proprietary medicines or certain listed herbs."
        ),
        "ask": "Can I sell my Ayurvedic product as a food or health supplement instead of a medicine, and what changes if I do?",
        "retrieval_queries": [R_AAHARA],
        "slots": [],
        "examples": [
            "does Ayurveda Aahara fall under food law rather than drug law",
            "can I sell my herbal powder as food",
            "health drink with ayurvedic herbs, what rules",
            "I want to sell it as a supplement not a medicine",
            "ayurvedic food product licence FSSAI",
            "herbal tea with tulsi and ginger, is it food or medicine",
        ],
    },
    # ------------------------------------------------------------------
    {
        "id": "brand_name",
        "title": "Protecting my brand or product name",
        "cues": [r"\bbrand", r"\btrade ?mark", r"\blogo\b", r"\b(product|brand|company'?s?) name\b", r"\bthe name\b"],
        "explain": (
            "A brand name is protected by registering it as a **trademark**. A name that only describes the product, "
            "or a name that is already common in the trade, is generally refused unless it has become distinctive "
            "through use."
        ),
        "ask": "Can I register my Ayurvedic product's name as a trademark, and which names would be refused?",
        "retrieval_queries": [R_TM_9],
        "slots": [],
        "examples": [
            "can I register my product name",
            "I don't want anyone else to use my brand name",
            "can I trademark a name like ashwagandha churna",
            "how to protect my ayurvedic brand name",
            "someone may copy my product name, what can I do",
            "trademark for my herbal company logo and name",
        ],
    },
    # ------------------------------------------------------------------
    {
        "id": "advertising_claims",
        "title": "What I can claim in advertisements",
        "cues": [r"\badverti", r"\bads?\b", r"\bclaims?\b", r"\bcan (i|we) say\b", r"\bpacket\b", r"\blabel\b"],
        "explain": (
            "The law prohibits advertising a drug in words that suggest it can diagnose, cure, treat or prevent "
            "certain listed diseases and conditions, whatever the product is made from."
        ),
        "ask": "What am I prohibited from claiming when I advertise my Ayurvedic product, for example saying it cures a disease?",
        "retrieval_queries": [R_DMR_3],
        "slots": [],
        "examples": [
            "which disease claims are prohibited in drug advertisements",
            "can I say my medicine cures sugar",
            "what can I write in advertisement for ayurvedic product",
            "can I post on instagram that my herbal oil treats disease",
            "rules for marketing claims of ayurvedic medicine",
            "is it allowed to say 100% cure in ads",
        ],
    },
    # ------------------------------------------------------------------
    {
        "id": "gi_tag",
        "title": "A GI tag for a product from my region",
        "cues": [r"\bgi\b", r"\bgeographical", r"\bregion", r"\bdistrict", r"\bvillage'?s? (product|name)\b"],
        "explain": (
            "A **geographical indication** (GI) identifies goods as coming from a particular region when their "
            "quality, reputation or other characteristic is essentially due to that place."
        ),
        "ask": "Can a region-specific Ayurvedic preparation get a Geographical Indication, and what must be true of it?",
        "retrieval_queries": [R_GI],
        "slots": [],
        "examples": [
            "what qualifies goods for geographical indication registration",
            "our village herbal product is famous, can we get GI tag",
            "product special to my area, how to protect it",
            "GI tag for traditional medicine from Kerala",
        ],
    },
    # ------------------------------------------------------------------
    {
        "id": "stop_others_patent",
        "title": "Stopping someone patenting our traditional knowledge",
        "cues": [r"\b(stop|challenge|oppos|revok|cancel|fight)\w*\b.*\bpatent", r"\bbiopiracy\b", r"\b(got|took|taken|granted) (a )?patent"],
        "explain": (
            "Anyone can **oppose** a published patent application before it is granted, or seek **revocation** of a "
            "granted patent, if the invention was already known to a local or indigenous community or the "
            "application hides where the biological material came from."
        ),
        "ask": "How can I stop or challenge a patent on a formulation that comes from our traditional knowledge?",
        "retrieval_queries": [R_PAT_25, R_PAT_64, R_PAT_3P],
        "slots": [],
        "examples": [
            "grounds for opposing a patent anticipated by indigenous community knowledge",
            "someone patented our traditional medicine, what can we do",
            "a company copied our village remedy and took patent",
            "how to cancel a patent on traditional knowledge",
            "biopiracy of our herbal knowledge, how to fight",
        ],
    },
    # ------------------------------------------------------------------
    {
        "id": "phytopharmaceutical",
        "title": "Registering a plant extract as a modern drug",
        "cues": [r"\bextract", r"\bfraction\b", r"\bmarkers?\b", r"\bcompounds?\b", r"\bphytopharma"],
        "explain": (
            "A **phytopharmaceutical drug** is a purified and standardised fraction of a medicinal plant extract, "
            "with at least four defined bioactive or phytochemical compounds, used to treat or prevent disease."
        ),
        "ask": "What is a phytopharmaceutical drug and what does my plant extract need to qualify as one?",
        "retrieval_queries": [R_PHYTO],
        "slots": [],
        "examples": [
            "definition of a phytopharmaceutical drug",
            "I made a standardised extract of a plant, how to get it approved as a drug",
            "plant extract with marker compounds approval",
            "is my purified herbal extract a phytopharmaceutical",
        ],
    },
    # ------------------------------------------------------------------
    {
        "id": "research_abroad",
        "title": "Sharing research on Indian plants with foreigners",
        "cues": [r"\bresearch", r"\bdata\b", r"\buniversit", r"\blab\b", r"\bstud(y|ies)\b"],
        "explain": (
            "Results of research on biological resources from India cannot be transferred to a foreign person, a "
            "non-resident or a company with foreign participation without prior approval of the National "
            "Biodiversity Authority, whether or not money is paid."
        ),
        "ask": "Can I share or transfer my research results on Indian plants with a foreign person or company, and what approval is needed?",
        "retrieval_queries": [R_SEC4_RESULTS],
        "slots": [],
        "examples": [
            "can I send my research on Indian herbs to a foreign university",
            "sharing plant research data with a foreign company",
            "collaborating with a foreign lab on ayurvedic plant research, any permission",
            "can I sell my herbal research results to a company abroad",
        ],
    },
]


# Questions this system must not route into any situation above: medical
# advice, other countries, writing tasks, unrelated technology. Scored as a
# class of its own so that a nearby-sounding question ("what dose of
# ashwagandha should I take") falls through to the normal pipeline, and its
# abstention gate, instead of being asked follow-up questions.
#
# As with the examples above, none of the benchmark's out-of-scope questions is
# copied here.
OUT_OF_SCOPE_EXAMPLES: List[str] = [
    "how much tulsi should I take every day",
    "which herb is good for my joint pain",
    "home remedy for cold and cough",
    "best exercise for weight loss",
    "recipe for masala chai",
    "export rules for herbal products to the USA",
    "EU regulations for selling herbal supplements in Germany",
    "write a product description for my herbal soap",
    "draft an instagram caption for my new face cream",
    "how to patent a mobile app",
    "can I patent a new battery design",
    "what is the price of ashwagandha powder",
    "side effects of turmeric capsules",
    "best ayurvedic college in India",
    "how to become a BAMS doctor",
]


# The "describe your situation" picker in the chat screen
# (client/src/components/chat/SituationBuilder.jsx). Its choices are already
# structured, so they are mapped here directly instead of being joined into a
# sentence and recognised: composed sentences such as "I am a farmer. I use
# Indian plants. I want a licence to make a medicine." mix the words of several
# situations, and recognising them offered the intended one for only 234 of 270
# combinations. The keys must match the picker's.
BUILDER_GOALS: Dict[str, str] = {
    "sell": "plants_in_business",
    "medicine": "medicine_licence",
    "food": "sell_as_food",
    "patent": "patent_my_product",
    "patent_permission": "patent_using_indian_plant",
    "extract_drug": "phytopharmaceutical",
    "brand": "brand_name",
    "advertise": "advertising_claims",
    "gi": "gi_tag",
    "research": "research_abroad",
    "stop_patent": "stop_others_patent",
}

# Each choice states facts for any situation that asks about them; a fact a
# situation does not ask about is ignored.
BUILDER_FACTS: Dict[str, Dict[str, Dict[str, str]]] = {
    "who": {
        "india_business": {"who": "indian_business", "applicant": "indian"},
        "practitioner": {"who": "practitioner"},
        "grower": {"who": "grower"},
        "foreign": {"who": "foreign", "applicant": "foreign"},
        "researcher": {},
    },
    "uses": {
        "plants": {},
        "classical": {"basis": "classical", "formula": "classical"},
        "own_mix": {"basis": "combination", "formula": "own_formula"},
        "extract": {"basis": "extract"},
    },
}


def intent_by_id(intent_id: str) -> Dict[str, Any]:
    return next((i for i in INTENTS if i["id"] == intent_id), None)
