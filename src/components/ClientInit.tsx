"use client";
import { useEffect } from "react";
import { hydrateStores } from "@/lib/store";

export function ClientInit() {
  useEffect(() => {
    hydrateStores();
  }, []);
  return null;
}
