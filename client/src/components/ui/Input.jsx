export default function Input({
  label,
  helperText,
  error,
  className = "",
  ...props
}) {
  return (
    <label className="block w-full">
      {label && (
        <span className="block text-sm text-gray-600 mb-1">{label}</span>
      )}
      <input
        {...props}
        className={`w-full border rounded-md px-3 py-2 outline-none transition-all duration-200 ${
          error ? "border-red-500 ring-2 ring-red-400/40" : "border-gray-300"
        } ${className}`}
      />
      {(helperText || error) && (
        <span
          className={`block mt-1 text-xs ${
            error ? "text-red-600" : "text-gray-500"
          }`}
        >
          {error || helperText}
        </span>
      )}
    </label>
  );
}
