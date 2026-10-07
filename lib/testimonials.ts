export type Testimonial = {
  id: string;
  name: string;
  role: string;
  photo: string;
  /** Short headline shown on the card front. Keep under ~85 chars so it fits 4 lines at 40px. */
  quote: string;
  /** Full comment revealed when the card flips. Keep under ~90 words. */
  comment: string;
};

const photos = [
  "/assets/avatar-demo/client/client1.png",
  "/assets/avatar-demo/client/client2.png",
];

// ponytail: placeholder copy; only two photos exist, so they alternate.
export const testimonials: Testimonial[] = [
  {
    name: "Nusrat Jahan",
    role: "Guardian of a Class 8 student",
    quote:
      "Working with Masters Hub has been an incredibly painless and enjoyable experience.",
    comment:
      "We had tried three tutors before finding Masters Hub. This time the match was right from the first session. Our tutor sends a short note after every class, so I always know what my son covered and where he needs help. Booking, rescheduling and payments all happen in one place, which saves me hours every month. Most importantly, he now looks forward to studying instead of dreading it.",
  },
  {
    name: "Farhana Rahman",
    role: "HSC candidate, Science",
    quote: "I finally understand physics instead of just memorising it.",
    comment:
      "Physics used to be a list of formulas I crammed the night before exams. My tutor rebuilt the basics with real examples and past papers, and suddenly the chapters connected. We kept a weekly plan in the app, so I never fell behind. My mock test score went from 58 to 81 in two months, and I actually enjoy solving problems now.",
  },
  {
    name: "Sharmin Akter",
    role: "Guardian of two students",
    quote:
      "Finding a trusted, verified tutor near home took one evening, not one month.",
    comment:
      "As a working parent, I could not spend weeks interviewing tutors. I filtered by subject and area, read the reviews from other guardians and shortlisted two tutors the same night. Every profile was verified, which gave me real peace of mind. Both my daughters now have tutors who come on time, follow a clear plan and keep me updated.",
  },
  {
    name: "Tahmina Chowdhury",
    role: "O Level student",
    quote:
      "My English tutor made speaking up in class feel easy for the first time.",
    comment:
      "I was always nervous about presentations and essays. My tutor focused on speaking first, then writing, with short practice tasks between sessions. She corrected my mistakes kindly and explained why, not just what. After one term I volunteered to present in class, and my English grade improved from a C to an A.",
  },
  {
    name: "Rumana Haque",
    role: "Guardian and banker",
    quote:
      "The SSC package made exam prep structured, simple and completely stress-free.",
    comment:
      "The package covered every subject my son needed, with one schedule and one point of contact. Tutors shared progress reports every two weeks, so we could fix weak areas early instead of panicking before the exam. The price was clear from day one, with no surprises. He finished SSC with a GPA 5, and our home was calm the whole year.",
  },
  {
    name: "Ayesha Siddiqua",
    role: "University student, BBA",
    quote:
      "Accounting went from my weakest subject to the one I help friends with.",
    comment:
      "I joined Masters Hub halfway through my semester, already behind in accounting. My tutor worked through my course outline, built practice sets from my own lecture notes and was flexible with timing around my classes. Within six weeks I caught up, and I finished the course with an A minus. I now recommend the platform to everyone in my batch.",
  },
].map((t, i) => ({ ...t, id: `testimonial-${i + 1}`, photo: photos[i % 2] }));
