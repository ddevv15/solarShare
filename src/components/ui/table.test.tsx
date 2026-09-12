import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Table, TableBody, TableCell, TableRow } from "./table";

describe("Table", () => {
  it("exposes a named keyboard-reachable scroll region", () => {
    const html = renderToStaticMarkup(
      <Table scrollRegionLabel="Available local solar offers">
        <TableBody>
          <TableRow>
            <TableCell>Sun Home</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Available local solar offers"');
    expect(html).toContain('tabindex="0"');
  });
});
