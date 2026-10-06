import { MeshGradient } from '@/components/mesh-gradient/mesh-gradient';
import TagLine from '@/components/TagLine';
import SearchBar from '@/components/SearchBar';
import OurHeroes from '@/components/OurHeroes';

export default function Home() {
  return (
    <div className='flex flex-col flex-1'>
      <MeshGradient
        className='min-h-[80vh] flex flex-col items-center px-6 pt-[calc(var(--navbar-top-offset)+var(--navbar-height)+45px)] text-center'
        animated
      >
        <TagLine />

        <h1 className='mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-[var(--color-neutral-charcoal)] sm:text-5xl md:text-6xl lg:text-7xl'>
          Find the right tutor, faster.
        </h1>
        <p className='mt-4 max-w-xl text-lg text-[var(--color-neutral-gray)]'>
          A smarter way to connect students and tutors—built for clarity, trust,
          and real results.
        </p>

        <SearchBar className='mt-[37px]' />

        <OurHeroes />
      </MeshGradient>
    </div>
  );
}
