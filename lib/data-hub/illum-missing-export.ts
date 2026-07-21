import {
  publicDealProjectId,
  type PublicDealRow,
} from "@/lib/public-deals/client";

export const ILLUM_DATA_FIELDS = [
  "system_size_kw",
  "pv_size",
  "install_date",
  "battery_size_kw",
  "gross_ppw",
  "ppw",
  "battery_price",
  "adder_details",
  "adder_amount",
] as const;

type IllumDataField = (typeof ILLUM_DATA_FIELDS)[number];
type ContainerName = "project" | "remittance";

type FieldSpec = {
  key: IllumDataField;
  sources: Array<{
    container: ContainerName;
    aliases: string[];
  }>;
};

const FIELD_SPECS: FieldSpec[] = [
  {
    key: "system_size_kw",
    sources: [{ container: "project", aliases: ["system_size_kw"] }],
  },
  {
    key: "pv_size",
    sources: [{ container: "remittance", aliases: ["pv_size"] }],
  },
  {
    key: "install_date",
    sources: [
      { container: "project", aliases: ["install_date", "installation_date"] },
      { container: "remittance", aliases: ["install_date", "installation_date"] },
    ],
  },
  {
    key: "battery_size_kw",
    sources: [
      { container: "project", aliases: ["battery_size_kw", "battery_size"] },
      { container: "remittance", aliases: ["battery_size_kw", "battery_size"] },
    ],
  },
  {
    key: "gross_ppw",
    sources: [{ container: "remittance", aliases: ["gross_ppw"] }],
  },
  {
    key: "ppw",
    sources: [{ container: "remittance", aliases: ["ppw"] }],
  },
  {
    key: "battery_price",
    sources: [{ container: "remittance", aliases: ["battery_price"] }],
  },
  {
    key: "adder_details",
    sources: [
      {
        container: "remittance",
        aliases: ["adder_details", "contract_adder_detail"],
      },
    ],
  },
  {
    key: "adder_amount",
    sources: [{ container: "remittance", aliases: ["adder_amount"] }],
  },
];

const POSITIVE_NUMBER_FIELDS = new Set<IllumDataField>([
  "system_size_kw",
  "pv_size",
  "battery_size_kw",
]);

function isBlank(value: unknown, field: IllumDataField): boolean {
  if (value == null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (
    typeof value === "object" &&
    value != null &&
    Object.keys(value as Record<string, unknown>).length === 0
  ) {
    return true;
  }
  if (POSITIVE_NUMBER_FIELDS.has(field)) {
    const number = Number(value);
    return !Number.isFinite(number) || number <= 0;
  }
  return false;
}

function readField(row: PublicDealRow, spec: FieldSpec): unknown {
  for (const source of spec.sources) {
    const container =
      source.container === "project" ? row.project : row.remittance ?? {};
    for (const alias of source.aliases) {
      const value = container[alias];
      if (!isBlank(value, spec.key)) return value;
    }
  }

  // Older imports may retain source-only values in the raw row.
  for (const source of spec.sources) {
    for (const alias of source.aliases) {
      const value = row.raw?.[alias];
      if (!isBlank(value, spec.key)) return value;
    }
  }
  return null;
}

export type IllumMissingExportRow = {
  project_id: string;
  hubspot_deal_id: string;
  opportunity_name: unknown;
  email: unknown;
  project_stage: unknown;
  missing_count: number;
  missing_fields: string;
} & Record<IllumDataField, unknown>;

export function buildIllumMissingExportRows(
  rows: PublicDealRow[],
): IllumMissingExportRow[] {
  return rows
    .map((row) => {
      const values = Object.fromEntries(
        FIELD_SPECS.map((spec) => [spec.key, readField(row, spec)]),
      ) as Record<IllumDataField, unknown>;
      const missing = ILLUM_DATA_FIELDS.filter((field) =>
        isBlank(values[field], field),
      );
      const projectId = publicDealProjectId(row);

      return {
        project_id: projectId,
        hubspot_deal_id: projectId.replace(/^hubspot_/, ""),
        opportunity_name: row.project.opportunity_name ?? null,
        email: row.project.email ?? null,
        project_stage: row.project.project_stage ?? null,
        missing_count: missing.length,
        missing_fields: missing.join("; "),
        ...values,
      };
    })
    .filter((row) => row.missing_count > 0)
    .sort((a, b) =>
      String(a.project_id).localeCompare(String(b.project_id), undefined, {
        numeric: true,
      }),
    );
}

const CSV_COLUMNS: Array<keyof IllumMissingExportRow> = [
  "project_id",
  "hubspot_deal_id",
  "opportunity_name",
  "email",
  "project_stage",
  "missing_count",
  "missing_fields",
  ...ILLUM_DATA_FIELDS,
];

function csvCell(value: unknown): string {
  if (value == null) return "";
  let text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  if (typeof value === "string" && /^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function illumMissingRowsToCsv(rows: IllumMissingExportRow[]): string {
  const header = CSV_COLUMNS.join(",");
  const body = rows.map((row) =>
    CSV_COLUMNS.map((column) => csvCell(row[column])).join(","),
  );
  return `\uFEFF${[header, ...body].join("\r\n")}`;
}
