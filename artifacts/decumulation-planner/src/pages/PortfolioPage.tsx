import { useState } from 'react';
import { usePlanner } from '../context/PlannerContext';
import AssetEditor from '../components/AssetEditor';
import CsvImportWizard from '../components/CsvImportWizard';
import mockRegister from '../data/mockRegister.json';
import type { Asset } from '../engine/decumulation';

const defaultRegister = mockRegister as Asset[];

export default function PortfolioPage() {
  const { assets, updateAssets } = usePlanner();
  const [editorOpen, setEditorOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  const totalValue = assets.reduce((sum, a) => sum + (a.current_value ?? 0), 0);
  const totalIncome = assets.reduce((sum, a) => sum + (a.income_generated ?? 0), 0);

  const fmt = (n: number) => '£' + Math.round(n).toLocaleString('en-GB');

  if (assets.length === 0) {
    return (
      <div className="portfolio-page">
        {editorOpen && (
          <AssetEditor
            assets={assets}
            defaults={defaultRegister}
            onChange={updateAssets}
            onClose={() => setEditorOpen(false)}
          />
        )}
        {csvImportOpen && (
          <CsvImportWizard
            existingAssets={assets}
            onImport={updateAssets}
            onClose={() => setCsvImportOpen(false)}
          />
        )}
        <div className="portfolio-empty">
          <h2>No assets in your portfolio</h2>
          <p>Add your assets to get started with planning. You can add individual assets or load a sample portfolio.</p>
          <div className="portfolio-empty-actions">
            <button className="portfolio-action-btn primary" onClick={() => setEditorOpen(true)}>
              + Add Assets
            </button>
            <button className="portfolio-action-btn" onClick={() => setCsvImportOpen(true)}>
              Import CSV
            </button>
            <button className="portfolio-action-btn" onClick={() => {
              updateAssets(defaultRegister.map(a => ({ ...a })));
            }}>
              Load Sample Portfolio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="portfolio-page">
      {editorOpen && (
        <AssetEditor
          assets={assets}
          defaults={defaultRegister}
          onChange={updateAssets}
          onClose={() => setEditorOpen(false)}
        />
      )}
      {csvImportOpen && (
        <CsvImportWizard
          existingAssets={assets}
          onImport={updateAssets}
          onClose={() => setCsvImportOpen(false)}
        />
      )}

      {/* Summary cards */}
      <div className="portfolio-summary">
        <div className="summary-card">
          <span className="summary-label">Total Portfolio</span>
          <span className="summary-value">{fmt(totalValue)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Annual Income</span>
          <span className="summary-value">{fmt(totalIncome)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Assets</span>
          <span className="summary-value">{assets.length}</span>
        </div>
        <div className="summary-card summary-card-action">
          <button className="portfolio-action-btn primary" onClick={() => setEditorOpen(true)}>
            Edit Assets
          </button>
          <button className="portfolio-action-btn" onClick={() => setCsvImportOpen(true)}>
            Import CSV
          </button>
        </div>
      </div>

      {/* Asset table */}
      <div className="portfolio-table-wrap">
        <table className="portfolio-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Type</th>
              <th className="num">Value</th>
              <th className="num">Growth</th>
              <th className="num">Income</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.asset_id}>
                <td className="asset-label">{a.label}</td>
                <td>
                  <span className={`asset-class-badge badge-${a.asset_class}`}>
                    {a.asset_class.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="num">{fmt(a.current_value)}</td>
                <td className="num">{(a.assumed_growth_rate * 100).toFixed(1)}%</td>
                <td className="num">{fmt(a.income_generated)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
