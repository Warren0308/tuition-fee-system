'use client';

interface YearSelectorProps {
  selectedYear: number;
  availableYears: number[];
}

export function YearSelector({ selectedYear, availableYears }: YearSelectorProps) {
  return (
    <select
      className="input-modern px-3 py-2"
      value={selectedYear}
      onChange={(e) => {
        const year = e.target.value;
        window.location.href = `/admin/terms?year=${year}`;
      }}
    >
      {availableYears.length > 0 ? (
        availableYears.map(year => (
          <option key={year} value={year}>
            {year} 学年
          </option>
        ))
      ) : (
        <option value={new Date().getFullYear()}>
          {new Date().getFullYear()} 学年
        </option>
      )}
    </select>
  );
}