import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

interface DonutDatum {
  name: string;
  value: number;
  color: string;
}

interface DonutProps {
  data: DonutDatum[];
}

export function Donut({ data }: DonutProps) {
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={46} outerRadius={70} paddingAngle={4}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
