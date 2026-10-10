import { TaskIcon } from "../assets/icons";

const tasks = [
  { count: 3, label: "Gathering wood", state: "In progress" },
  { count: 2, label: "Planting crops", state: "In progress" },
  { count: 1, label: "Constructing building", state: "In progress" },
  { count: 2, label: "Hunting", state: "In progress" },
  { count: 4, label: "Idle", state: "" },
] as const;

export default function ActiveTasks() {
  return (
    <section className="eon-card">
      <header>
        <h2>Active Tasks (12)</h2>
        <button type="button">View All</button>
      </header>
      <ul className="eon-tasks">
        {tasks.map((task) => (
          <li key={task.label}>
            <b>{task.count}</b>
            <TaskIcon />
            <span>{task.label}</span>
            {task.state ? <em>{task.state}</em> : <s />}
          </li>
        ))}
      </ul>
    </section>
  );
}
