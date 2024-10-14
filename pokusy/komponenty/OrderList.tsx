// ProductList.tsx
import React from "react";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useOrders } from "@/hooks/useOrders";
import { Badge } from "./ui/badge";

export const OrderList: React.FC = () => {
  const { data: orders, isLoading, error } = useOrders();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4  gap-2">
      {orders?.map((order) => (
        <Card key={order.id}>
          <CardHeader>
            <CardTitle className="flex justify-between">
              <div className="font-semibold text-gray-600">
                {new Date(order.date).toLocaleDateString()}
              </div>

              <Badge className="" variant="outline">
                {order.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-between">
            <div className=" text-gray-500"># {order.id}</div>
            <div className="font-bold">{order.total} Kč</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
