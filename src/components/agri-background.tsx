/**
 * Veta Kipawa — animated agriculture background.
 * Pure CSS; renders sun, drifting clouds, growing crops, rolling hills,
 * and an optional light rain layer. Honors prefers-reduced-motion.
 */
export function AgriBackground({ rain = false }: { rain?: boolean }) {
  return (
    <div aria-hidden className="vk-agri-bg">
      <div className="vk-sun" />
      <div className="vk-cloud vk-cloud-1" />
      <div className="vk-cloud vk-cloud-2" />
      <div className="vk-cloud vk-cloud-3" />

      {rain &&
        Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className="vk-rain"
            style={{
              left: `${(i * 100) / 28 + Math.random() * 3}%`,
              animationDelay: `${-Math.random() * 1.6}s`,
              animationDuration: `${1.2 + Math.random() * 0.9}s`,
            }}
          />
        ))}

      <div className="vk-hills">
        <div className="vk-hill vk-hill-back" />
        <div className="vk-hill vk-hill-mid" />
        <div className="vk-hill vk-hill-front" />
      </div>
      <div className="vk-ground" />
      <div className="vk-plants">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className="vk-plant" />
        ))}
      </div>
    </div>
  );
}
