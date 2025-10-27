export default function Button({
  children,
  variant = "primary", // primary | outline | danger | ghost
  size = "md",         // sm | md | lg
  loading = false,
  className = "",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200";
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2",
    lg: "px-5 py-3 text-lg",
  };
  const variants = {
    primary:
      "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md active:scale-95",
    outline:
      "border border-gray-300 text-gray-700 hover:bg-gray-50 active:scale-95",
    danger:
      "bg-red-600 text-white hover:bg-red-700 hover:shadow-md active:scale-95",
    ghost:
      "text-gray-700 hover:bg-gray-100 active:scale-95",
  };

  return (
    <button
      {...props}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={loading || props.disabled}
    >
      {loading && (
        <span
          className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}
