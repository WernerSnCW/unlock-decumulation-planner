import { useState } from 'react';
import type { TaxParametersFile } from '../engine/taxLogic';

interface Props {
  taxParams: TaxParametersFile;
}

export default function DisclosurePanel({ taxParams }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="disclosure-panel">
      <button
        className="disclosure-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>Model Assumptions & Disclosure</span>
        <span style={{ fontSize: 14 }}>{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="disclosure-body">
          <ul>
            <li>{taxParams.hold_flat_disclosure}</li>
            <li>Growth rates are assumed constant per asset and applied annually. No volatility or sequence-of-returns risk is modelled.</li>
            <li>Income from assets (interest, rent, dividends) is assumed constant in nominal terms throughout the plan.</li>
            <li>Inflation is applied to the spend target only. Asset growth rates are nominal, not real.</li>
            <li>Tax parameters are based on HMRC rates for 2025/26 and held flat for all future years.</li>
            <li>Personal allowance taper applies above £100,000 adjusted net income.</li>
            <li>CGT uses average-cost basis as a proxy. Full HMRC share matching rules are not implemented.</li>
            <li>VCT disposals are CGT-exempt (TCGA 1992 s.151A). Early disposal triggers income tax relief clawback.</li>
            <li>EIS shares held &gt;3 years are CGT-exempt. Deferred gains crystallise on disposal.</li>
            <li>BPR relief requires 2+ years' qualifying ownership. The April 2026 cap (£2.5M combined BPR/APR at 100%, 50% above) reflects announced policy — toggle to compare impact.</li>
            <li>From April 2027 (proposed), undrawn pension funds are included in the IHT-liable estate. Toggle to compare impact.</li>
            <li>PCLS (tax-free lump sum) is 25% of crystallisation, capped at the remaining Lump Sum Allowance (£268,275 lifetime).</li>
            <li>IHT nil-rate band is reduced by chargeable lifetime transfers (CLTs) in the preceding 7 years.</li>
            <li>RNRB (Residence Nil-Rate Band) is not modelled in this version.</li>
            <li>Property disposal costs are estimated at the percentage specified per asset. No stamp duty on disposal is modelled.</li>
            <li>Gifting follows PET / CLT / NEFI rules. The £3,000 annual exemption (with one year carry-forward) is applied before classifying gifts.</li>
            <li>This tool produces planning estimates only. It does not constitute tax, legal, or financial advice. Consult a qualified adviser before acting on these projections.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
