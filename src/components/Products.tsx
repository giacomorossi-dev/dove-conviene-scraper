"use client";
import {
  type ColumnDef,
  flexRender,
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Flyer } from "@/models";
import { useMemo } from "react";

interface Props {
  flyers: Array<Flyer>;
}

const Products: React.FC<Props> = ({ flyers }) => {
  const columnHelper = createColumnHelper();

  const data: Array<{
    name: string;
    price: number;
    flyer: {
      name: string;
      url: string;
      imageUrl: string;
    };
  }> = [];
  flyers.forEach((flyer) => {
    flyer.products?.forEach((product) => {
      data.push({
        name: Products.name,
        price: product.price,
        flyer: {
          name: flyer.name,
          url: flyer.url,
          imageUrl: flyer.imageUrl,
        },
      });
    });
  });

  const columns = [
    columnHelper.accessor(
      (row) => (
        <div className="flex flex-col gap-1">
          <img src={row.flyer.imageUrl} />
          <div>{row.flyer.name}</div>
        </div>
      ),
      {
        id: "flyer",
        header: "Flyer",
      }
    ),
    columnHelper.accessor("name", {
      header: "Name",
    }),
    columnHelper.accessor("price", {
      header: "Price",
    }),
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default Products;
