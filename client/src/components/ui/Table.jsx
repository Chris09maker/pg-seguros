export default function Table({ head = [], rows = [], className = "" }) {
  return (
    <div className={`overflow-x-auto rounded-xl border ${className}`}>
      <table className="min-w-full text-sm">
        {head.length > 0 && (
          <thead className="bg-gray-50">
            <tr>
              {head.map((h, idx) => (
                <th
                  key={idx}
                  className="text-left font-semibold text-gray-700 px-4 py-3"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                className="text-center text-gray-500 px-4 py-6"
                colSpan={head.length || 1}
              >
                Sin registros
              </td>
            </tr>
          ) : (
            rows.map((cells, idx) => (
              <tr
                key={idx}
                className={idx % 2 ? "bg-white" : "bg-gray-50/50"}
              >
                {cells.map((c, i) => (
                  <td key={i} className="px-4 py-3">
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
