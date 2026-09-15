import type { SessionAnalysis } from "@kaden/shared-types";

/** Primer izlaza (Sep 14 recovery) — da UI renderuje pravi coach format bez backenda. */
export const sampleAnalysis: SessionAnalysis = {
  sessionId: "24360297055",
  date: "2026-09-14",
  classification: "easy",
  verdict: "on_track",
  basics:
    "8.01 km za 54.4 min, pace 6:47/km, avg HR 136, max HR 147, TE 3.1, aerobni load 83.9, kadenca 164 spm.",
  zones:
    "Odličan zonski profil za easy: 82% vremena u Z3 (134-152), praktično 0% u Z4/Z5, avg HR 136 je ispod easy praga (145) i van sive zone (150-160). Prava regeneracija.",
  assessment:
    "Solidan, kontrolisan lagani trening. HR je niži nego na prethodnom easy (07.09 — avg 140), pace sporiji (6:47 vs 6:40) — dobra disciplina, ne 'trka na easy danu'. Decoupling 4.6% je u redu, aerobni sistem stabilan. Kadenca 164 spm tačno na donjoj granici cilja.",
  comparisons: [
    "07.09 easy 8km: avg HR 140 @ 6:40 vs danas 136 @ 6:47 — niži HR uz sporiji pace",
    "Kadenca raste: 162 spm (07.09) → 164 spm (danas), ka cilju 164-167",
    "Decoupling danas 4.6% vs 5% na 07.09 — blago bolja aerobna stabilnost",
  ],
  nextStep:
    "Sledeći easy drži u istom HR opsegu (<145, izbegavaj 150-160). 3.7 nedelje do Zagreba (peak faza): 1 tempo (155-169) sredinom nedelje + 1 dugi (140-152) vikendom.",
  question:
    "Kako su ti se osećali listovi/noge danas nakon dugog trčanja od 11.09 — je li ovaj easy prošao lako ili si osećao zaostali umor?",
  coachingNote:
    "Ova analiza je informativnog karaktera na osnovu trening podataka, ne predstavlja medicinski savet — za bilo kakve simptome ili bol konsultuj stručnjaka.",
  memoryUpdate: [
    "Easy avg HR 136-140, dobro drži disciplinu <145",
    "Kadenca ka cilju 164-167 (162→164)",
  ],
};
