import { useParams } from 'react-router-dom';

export default function SessionView() {
  const { id } = useParams();
  return <div>Session View {id}</div>;
}
