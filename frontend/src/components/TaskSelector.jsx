export default function TaskSelector({ tasks, selectedTask, onSelect, disabled }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tasks.map((task) => (
        <button
          key={task.id}
          onClick={() => onSelect(task.id)}
          disabled={disabled}
          title={task.description}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            selectedTask === task.id
              ? 'bg-orange-500 text-white shadow-sm shadow-orange-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {task.label}
        </button>
      ))}
    </div>
  )
}
