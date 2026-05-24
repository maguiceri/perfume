import FluidBackground from './components/FluidBackground';
import Header from './components/Header';
import PerfumeScene from './components/PerfumeScene';
import SmoothScroll from './components/SmoothScroll';

export default function Home() {
  return (
    <>
      <SmoothScroll />
      <FluidBackground />
      <Header />
      <PerfumeScene />
      <div style={{ height: '550vh' }} />
    </>
  );
}
