import ColorSelect from "@/components/ColorSelect";
import { getTextColorClass } from "@/lib/text-colors";
interface Props {
  workName: string;
  workAddress: string;
  workNameColor: string;
  workAddressColor: string;
  onWorkNameColorChange: (value: string) => void;
  onWorkAddressColorChange: (value: string) => void;
  onWorkNameChange: (value: string) => void;
  onWorkAddressChange: (value: string) => void;
}
export function BudgetWorkFields({ workName, workAddress, workNameColor, workAddressColor, onWorkNameChange, onWorkAddressChange, onWorkNameColorChange, onWorkAddressColorChange }: Props) {
  return (
    <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label htmlFor="budget-work-name" className="block text-sm font-medium text-slate-700 mb-1.5">Obra / trabajo a realizar *</label>
        <input id="budget-work-name" required maxLength={200} value={workName} onChange={(e) => onWorkNameChange(e.target.value)} placeholder="Ej.: Reforma eléctrica del local" className={`input-field ${getTextColorClass(workNameColor)}`} /><ColorSelect value={workNameColor} onChange={onWorkNameColorChange} />
      </div>
      <div>
        <label htmlFor="budget-work-address" className="block text-sm font-medium text-slate-700 mb-1.5">Dirección de la obra *</label>
        <input id="budget-work-address" required maxLength={500} value={workAddress} onChange={(e) => onWorkAddressChange(e.target.value)} placeholder="Calle, número, piso, localidad y código postal" className={`input-field ${getTextColorClass(workAddressColor)}`} /><ColorSelect value={workAddressColor} onChange={onWorkAddressColorChange} />
        <p className="text-xs text-slate-500 mt-1">Es la dirección de este trabajo; puede ser distinta a la del cliente.</p>
      </div>
    </div>
  );
}
