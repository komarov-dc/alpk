import AlpakaApp from '@/components/AlpakaApp';

interface ProjectPageProps {
  params: Promise<{
    projectName: string;
  }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectName } = await params;
  return <AlpakaApp projectName={decodeURIComponent(projectName)} />;
}
