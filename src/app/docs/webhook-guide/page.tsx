import { Metadata } from "next";

export const metadata: Metadata = {
  title: "TRLN Webhook Integration Guide",
  description: "Referral webhook integration guide for Frost Law",
};

export default function WebhookGuidePage() {
  return (
    <div
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        maxWidth: 800,
        margin: "40px auto",
        padding: "0 20px",
        color: "#1a1a1a",
        lineHeight: 1.6,
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, color: "#c4a050", letterSpacing: 2, marginBottom: 4 }}>TRLN</div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 30 }}>
        Tariff Refund &amp; Litigation Network &mdash; Partner Portal
      </div>

      <h1 style={{ fontSize: 24, borderBottom: "2px solid #c4a050", paddingBottom: 10 }}>
        Referral Webhook Integration Guide
      </h1>

      {/* Endpoint Details */}
      <h2 style={{ fontSize: 18, marginTop: 30, color: "#333" }}>Endpoint Details</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", margin: "16px 0", fontSize: 14 }}>
        <tbody>
          <tr><td style={{ padding: "10px 14px", borderBottom: "1px solid #e0e0e0", fontWeight: 600, width: 160 }}>Webhook URL</td><td style={{ padding: "10px 14px", borderBottom: "1px solid #e0e0e0" }}><code style={codeStyle}>https://trln.partners/api/webhook/referral</code></td></tr>
          <tr style={{ background: "#f9f9f9" }}><td style={{ padding: "10px 14px", borderBottom: "1px solid #e0e0e0", fontWeight: 600 }}>Method</td><td style={{ padding: "10px 14px", borderBottom: "1px solid #e0e0e0" }}><code style={codeStyle}>POST</code></td></tr>
          <tr><td style={{ padding: "10px 14px", borderBottom: "1px solid #e0e0e0", fontWeight: 600 }}>Content-Type</td><td style={{ padding: "10px 14px", borderBottom: "1px solid #e0e0e0" }}><code style={codeStyle}>application/json</code></td></tr>
          <tr style={{ background: "#f9f9f9" }}><td style={{ padding: "10px 14px", borderBottom: "1px solid #e0e0e0", fontWeight: 600 }}>Security Header</td><td style={{ padding: "10px 14px", borderBottom: "1px solid #e0e0e0" }}><code style={codeStyle}>x-webhook-secret: [provided separately]</code></td></tr>
        </tbody>
      </table>

      <div style={infoBoxStyle}>
        The security header is required on all requests. The secret token will be provided separately via secure channel. Requests without a valid token will receive a <code style={codeStyle}>401 Unauthorized</code> response.
      </div>

      {/* Accepted Fields */}
      <h2 style={{ fontSize: 18, marginTop: 30, color: "#333" }}>Accepted Fields</h2>
      <p>All fields should be sent as a flat JSON object in the POST body. Field names are flexible &mdash; the endpoint accepts multiple naming conventions (snake_case, camelCase, or form labels).</p>

      <table style={{ width: "100%", borderCollapse: "collapse", margin: "16px 0", fontSize: 14 }}>
        <thead>
          <tr>
            <th style={thStyle}>Category</th>
            <th style={thStyle}>Fields</th>
            <th style={thStyle}>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdStyle}><strong>Partner tracking</strong></td>
            <td style={tdStyle}><code style={codeStyle}>utm_content</code> <code style={codeStyle}>referral_code</code> <code style={codeStyle}>partner_code</code></td>
            <td style={tdStyle}>Identifies which TRLN partner referred the client. Passed through from the referral link URL parameter.</td>
          </tr>
          <tr>
            <td style={tdStyleAlt}><strong>Client info</strong></td>
            <td style={tdStyleAlt}><code style={codeStyle}>first_name</code> <code style={codeStyle}>last_name</code> <code style={codeStyle}>email</code> <code style={codeStyle}>phone</code> <code style={codeStyle}>business_title</code></td>
            <td style={tdStyleAlt}>Client contact details. At least one of name, email, or company is required.</td>
          </tr>
          <tr>
            <td style={tdStyle}><strong>Business</strong></td>
            <td style={tdStyle}><code style={codeStyle}>legal_entity_name</code> <code style={codeStyle}>service_of_interest</code> <code style={codeStyle}>city</code> <code style={codeStyle}>state</code></td>
            <td style={tdStyle}>Business/company details and location.</td>
          </tr>
          <tr>
            <td style={tdStyleAlt}><strong>Tariff</strong></td>
            <td style={tdStyleAlt}><code style={codeStyle}>imports_goods</code> <code style={codeStyle}>import_countries</code> <code style={codeStyle}>annual_import_value</code> <code style={codeStyle}>importer_of_record</code></td>
            <td style={tdStyleAlt}>Tariff-specific qualification fields.</td>
          </tr>
          <tr>
            <td style={tdStyle}><strong>Deal stage</strong></td>
            <td style={tdStyle}><code style={codeStyle}>dealstage</code> <code style={codeStyle}>deal_stage</code> <code style={codeStyle}>stage</code> <code style={codeStyle}>pipeline_stage</code> <code style={codeStyle}>status</code></td>
            <td style={tdStyle}>Current stage in your pipeline. Stored exactly as sent (not mapped or transformed).</td>
          </tr>
          <tr>
            <td style={tdStyleAlt}><strong>Notes</strong></td>
            <td style={tdStyleAlt}><code style={codeStyle}>affiliate_notes</code></td>
            <td style={tdStyleAlt}>Any additional notes or comments from the form submission.</td>
          </tr>
        </tbody>
      </table>

      {/* Example Request */}
      <h2 style={{ fontSize: 18, marginTop: 30, color: "#333" }}>Example Request</h2>
      <pre style={preStyle}>{`POST https://trln.partners/api/webhook/referral
Content-Type: application/json
x-webhook-secret: [your-secret-token]

{
  "utm_content": "PTNABC123",
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane@acmeimports.com",
  "phone": "(555) 123-4567",
  "business_title": "CFO",
  "legal_entity_name": "Acme Imports LLC",
  "service_of_interest": "Tariff Refund Support",
  "city": "Phoenix",
  "state": "AZ",
  "imports_goods": "Yes",
  "import_countries": "China, Vietnam",
  "annual_import_value": "$1M - $5M",
  "importer_of_record": "Acme Imports LLC",
  "dealstage": "Qualified",
  "affiliate_notes": "Referred by CPA network"
}`}</pre>

      {/* Responses */}
      <h2 style={{ fontSize: 18, marginTop: 30, color: "#333" }}>Responses</h2>

      <h3 style={{ fontSize: 15, marginTop: 24, color: "#555" }}>Success (201 Created)</h3>
      <pre style={preStyle}>{`{
  "received": true,
  "dealId": "clx1234...",
  "dealName": "Acme Imports LLC",
  "partnerCode": "PTNABC123"
}`}</pre>

      <h3 style={{ fontSize: 15, marginTop: 24, color: "#555" }}>Validation Error (400)</h3>
      <pre style={preStyle}>{`{
  "error": "At least one of: name, email, or company is required"
}`}</pre>

      <h3 style={{ fontSize: 15, marginTop: 24, color: "#555" }}>Unauthorized (401)</h3>
      <pre style={preStyle}>{`{
  "error": "Unauthorized"
}`}</pre>

      {/* Partner Tracking */}
      <h2 style={{ fontSize: 18, marginTop: 30, color: "#333" }}>How Partner Tracking Works</h2>
      <ol>
        <li>TRLN partners share a referral link:<br /><code style={codeStyle}>https://referral.frostlawaz.com/l/ANNEXATIONPR/?utm_content=PTNABC123</code></li>
        <li>The client fills out the Frost Law referral form</li>
        <li>The form system passes the <code style={codeStyle}>utm_content</code> value through to the webhook payload</li>
        <li>TRLN records the deal and attributes it to the correct partner</li>
        <li>The partner sees the deal in their portal dashboard</li>
      </ol>

      <div style={infoBoxStyle}>
        If <code style={codeStyle}>utm_content</code> is not present in the payload, the deal is still created and stored as &quot;UNATTRIBUTED&quot; so no leads are lost.
      </div>

      {/* Health Check */}
      <h2 style={{ fontSize: 18, marginTop: 30, color: "#333" }}>Health Check</h2>
      <p>To verify the endpoint is live, send a <code style={codeStyle}>GET</code> request to the same URL:</p>
      <pre style={preStyle}>GET https://trln.partners/api/webhook/referral</pre>
      <p>Returns a JSON object with field documentation and endpoint status.</p>

      <div style={{ marginTop: 40, paddingTop: 16, borderTop: "1px solid #ddd", fontSize: 12, color: "#999" }}>
        TRLN Partner Portal &mdash; Webhook Integration Guide<br />
        Generated April 2026
      </div>
    </div>
  );
}

const codeStyle: React.CSSProperties = { background: "#f0f0f0", padding: "2px 6px", borderRadius: 3, fontSize: 13, fontFamily: "'SF Mono', Monaco, Consolas, monospace" };
const preStyle: React.CSSProperties = { background: "#1a1a2e", color: "#e0e0e0", padding: "16px 20px", borderRadius: 8, overflowX: "auto", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" };
const thStyle: React.CSSProperties = { background: "#1a1a2e", color: "#f0d070", textAlign: "left", padding: "10px 14px", fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid #e0e0e0", verticalAlign: "top" };
const tdStyleAlt: React.CSSProperties = { ...tdStyle, background: "#f9f9f9" };
const infoBoxStyle: React.CSSProperties = { background: "#fdf6e3", borderLeft: "4px solid #c4a050", padding: "12px 16px", margin: "16px 0", borderRadius: "0 6px 6px 0", fontSize: 14 };
