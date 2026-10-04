import { MeshGradient } from "@/components/mesh-gradient/mesh-gradient";

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      <MeshGradient
        className="min-h-[80vh] flex flex-col items-center justify-center px-6 py-32 text-center"
        animated
      >
        <p className="text-sm font-medium tracking-widest uppercase text-[var(--color-neutral-gray)]">
          TutorMatch
        </p>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-[var(--color-neutral-charcoal)] sm:text-5xl md:text-6xl lg:text-7xl">
          Find the right tutor, faster.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-[var(--color-neutral-gray)]">
          A smarter way to connect students and tutors—built for clarity,
          trust, and real results.
        </p>
      </MeshGradient>
    </div>
  );
}
