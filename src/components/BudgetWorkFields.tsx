import { getTextColorClass } from "@/lib/text-colors";
interface Props {
  textColor?: string;
  workName: string;
  workAddress: string;
  onWorkNameChange: (value: string) => void;
  onWorkAddressChange: (value: string) => void;
}
export function BudgetWorkFields({ textColor, workName, workAddress, onWorkNameChange, onWorkAddressChange }: Props) {
  return (
    <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label htmlFor="budget-work-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Obra / trabajo a realizar *</label>
        <input id="budget-work-name" required maxLength={200} value={workName} onChange={(e) => onWorkNameChange(e.target.value)} placeholder="Ej.: Reforma eléctrica del local" className={`input-field ${getTextColorClass(textColor)}`} />
      </div>
      <div>
        <label htmlFor="budget-work-address" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Dirección de la obra *</label>
        <input id="budget-work-address" required maxLength={500} value={workAddress} onChange={(e) => onWorkAddressChange(e.target.value)} placeholder="Calle, número, piso, localidad y código postal" className={`input-field ${getTextColorClass(textColor)}`} />
        <p className="text-xs text-slate-500 mt-1">Es la dirección de este trabajo; puede ser distinta a la del cliente.</p>
      </div>
    </div>
  );
}
