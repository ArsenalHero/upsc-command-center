export interface BookSuggestion {
  id: string;
  title: string;
  author: string;
  subject: string;
  kind: "Foundation" | "Reference";
  description: string;
  url: string;
  source: string;
  free?: boolean;
}
// Publisher and NCERT titles checked on 2026-10-04. Chapter totals vary by edition.
export const bookSuggestions: BookSuggestion[] = [
  { id: "ncert-polity", title: "Indian Constitution at Work — Class XI", author: "NCERT", subject: "Polity", kind: "Foundation", description: "Build a foundation in constitutional institutions and how they work.", url: "https://ncert.nic.in/textbook.php?keps2=0-10", source: "NCERT textbooks", free: true },
  { id: "ncert-geography", title: "Fundamentals of Physical Geography — Class XI", author: "NCERT", subject: "Geography", kind: "Foundation", description: "Start with physical geography concepts before a detailed reference book.", url: "https://ncert.nic.in/textbook.php?kegy2=0-14", source: "NCERT textbooks", free: true },
  { id: "ncert-economy", title: "Indian Economic Development — Class XI", author: "NCERT", subject: "Economy", kind: "Foundation", description: "Introduce India's development, economic reforms and social sectors.", url: "https://ncert.nic.in/textbook.php?keec1=0-8", source: "NCERT textbooks", free: true },
  { id: "laxmikanth", title: "Indian Polity", author: "M. Laxmikanth", subject: "Polity", kind: "Reference", description: "A reference for the Constitution, governance and political institutions.", url: "https://www.mheducation.co.in/courseware-on-indian-polity-9789364447676-india", source: "McGraw Hill" },
  { id: "spectrum", title: "A Brief History of Modern India", author: "Spectrum Books", subject: "History", kind: "Reference", description: "Study modern India and the national movement in chronological order.", url: "https://spectrumbooks.in/books/english/a-brief-history-of-modern-india-2025", source: "Spectrum Books" },
  { id: "leong", title: "Certificate Physical and Human Geography", author: "Goh Cheng Leong", subject: "Geography", kind: "Reference", description: "Develop physical geography and world climate concepts alongside maps.", url: "https://india.oup.com/product/certificate-physical-and-human-geography-9789354975660/", source: "Oxford University Press" },
  { id: "ramesh-singh", title: "Indian Economy", author: "Ramesh Singh", subject: "Economy", kind: "Reference", description: "Connect economic concepts with India's policies and development.", url: "https://www.mheducation.co.in/courseware-on-indian-economy-9789364446570-india", source: "McGraw Hill" },
  { id: "shankar", title: "Environment", author: "Shankar IAS Academy", subject: "Environment", kind: "Reference", description: "Organise your ecology, biodiversity and environmental policy reading.", url: "https://www.shankariasacademy.com/upsc-environment-book/", source: "Shankar IAS Academy" },
  { id: "nitin-singhania", title: "Indian Art and Culture", author: "Nitin Singhania", subject: "Art & Culture", kind: "Reference", description: "Use as a reference for Indian heritage, art forms and cultural traditions.", url: "https://edge.mheducation.co.in/course/ArtandCulture-UPSC-NitinSinghania-172", source: "McGraw Hill" },
];
