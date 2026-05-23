import FluidBackground from './components/FluidBackground';
import Header from './components/Header';
import PerfumeScene from './components/PerfumeScene';

export default function Home() {
  return (
    <>
      <FluidBackground />
      <Header />
      <PerfumeScene />
      <div style={{ height: '550vh' }} />
    </>
  );
}
