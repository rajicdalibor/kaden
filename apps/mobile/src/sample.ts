import type { Analysis } from "./AnalysisView";

/** Offline primer — da UI ima šta da prikaže bez backenda. */
export const sampleAnalysis: Analysis = {
  sessionId: "sample",
  date: "2026-09-11",
  classification: "long",
  narrative:
    "Ovo je **ogroman trening** i baš onakav kakav ti treba tri i po nedelje pre Zagreba.\n\n" +
    "Zadnjih 5km na avg **5:47/km** posle 15km i na umoran organizam — suštinski HM-tempo simulacija. Recovery HR 50 je najbolji do sada; aerobna baza je jaka.\n\n" +
    "Za Zagreb: sub-2h je i dalje realno, bafer iznad 5:41 postoji. Naredna 2-3 dana pravi oporavak — san prioritet.\n\n" +
    "Kako se osećaš dan kasnije — noge, listovi?",
};
