"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RoleNavigation } from "../components/role-navigation";
import { apiDelete, apiGet, apiPost } from "../lib/api";
import { Toast } from "../components/toast";
import {
  formatMoney,
  formatStatus,
  Property,
  PropertyListResponse
} from "./types";

type CatalogFilters = {
  q: string;
  maxPrice: string;
  minPrice: string;
  regionId: string;
  type: string;
};

type FavoritesResponse = {
  data: Array<{ propertyId: number }>;
};

type RegionOption = {
  id: number;
  name: string;
  code: string;
  city: string | null;
  district: string | null;
  ward: string | null;
};

type RegionOptionsResponse = {
  data: RegionOption[];
};

const catalogTypeOptions = [
  { label: "1 Bedroom", value: "ONE_BEDROOM" },
  { label: "2 Bedrooms", value: "TWO_BEDROOM" },
  { label: "Apartment", value: "APARTMENT" },
  { label: "Mini Apartment", value: "MINI_APARTMENT" },
  { label: "Duplex", value: "DUPLEX" },
  { label: "Studio", value: "STUDIO" }
];

const initialFilters: CatalogFilters = {
  q: "",
  maxPrice: "",
  minPrice: "",
  regionId: "",
  type: ""
};

export default function PropertyCatalogPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [currentPage, setCurrentPage] = useState(1); 
  const [pageSize, setPageSize] = useState(20);      
  const [response, setResponse] = useState<PropertyListResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [savedPropertyIds, setSavedPropertyIds] = useState<number[]>([]);
  const [savingPropertyId, setSavingPropertyId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" } | null>(null);
  const [isManualFilter, setIsManualFilter] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(pageSize),       
      page: String(currentPage),    
      sortBy: "createdAt",
      sortOrder: "desc"
    });

    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value) {
        if (key === "minPrice" || key === "maxPrice") {
          params.set(key, String(Number(value.replace(",", ".")) * 1000000));
        } else if (key !== "type") {
          params.set(key, value);
        }
      }
    });
    applyTypeFilter(params, appliedFilters.type);

    return params.toString();
  }, [appliedFilters, currentPage, pageSize]);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError("");

    apiGet<PropertyListResponse>(`/properties?${query}`)
      .then((data) => {
        if (isCurrent) {
          setResponse(data);

          if (isManualFilter) {
            const totalFound = data.data?.length ?? 0;
            setToast({
              message: `Filtered successfully! Found ${totalFound} ${totalFound === 1 ? "property" : "properties"}.`,
              type: "success",
            });
            setIsManualFilter(false); // Reset cờ
          }
        }
      })
      .catch((caughtError) => {
        if (isCurrent) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load properties."
          );
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [query]);

  useEffect(() => {
    const token = localStorage.getItem("selapAccessToken");
    if (!token) return;

    apiGet<FavoritesResponse>("/favorites", { token })
      .then((response) => setSavedPropertyIds(response.data.map((favorite) => favorite.propertyId)))
      .catch(() => {
        // The public catalogue remains available when a saved list cannot be loaded.
      });
  }, []);

  useEffect(() => {
    apiGet<RegionOptionsResponse>("/properties/regions/public-options")
      .then((response) => setRegions(response.data))
      .catch(() => {
        // The catalogue can still be searched when region options fail to load.
      });
  }, []);

  function updateFilter(name: keyof CatalogFilters, value: string) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsManualFilter(true);
    setCurrentPage(1);
    setAppliedFilters(filters);
  }

  async function toggleSavedProperty(propertyId: number) {
    if (savingPropertyId !== null) return;
    const token = localStorage.getItem("selapAccessToken");
    if (!token) {
      setError("Please sign in to save properties.");
      return;
    }

    const isSaved = savedPropertyIds.includes(propertyId);
    setSavingPropertyId(propertyId);
    setError("");
    try {
      if (isSaved) {
        await apiDelete(`/favorites/${propertyId}`, { token });
        setSavedPropertyIds((current) => current.filter((id) => id !== propertyId));
      } else {
        await apiPost(`/favorites/${propertyId}`, { token });
        setSavedPropertyIds((current) => [...current, propertyId]);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update saved properties.");
    } finally {
      setSavingPropertyId(null);
    }
  }

  const properties = response?.data ?? [];
  const totalPages = response?.meta?.totalPages ?? 1;

  return (
    <main className="catalogMockPage">
      <div className="catalogMockShell">
        <RoleNavigation />

        <form className="mockFilterBar" onSubmit={applyFilters}>
          <input
            aria-label="Search"
            onChange={(event) => updateFilter("q", event.target.value)}
            placeholder="Search by property, street or building"
            value={filters.q}
          />
          <select
            aria-label="Area"
            onChange={(event) => updateFilter("regionId", event.target.value)}
            value={filters.regionId}
          >
            <option value="">Area</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {formatRegionOption(region)}
              </option>
            ))}
          </select>
          <div className="mockPriceField">
            <input
              aria-label="Minimum price"
              min="0"
              onChange={(event) => updateFilter("minPrice", event.target.value)}
              placeholder="Min"
              type="number"
              value={filters.minPrice}
            />
            <span className="mockPriceSeparator">-</span>
            <input
              aria-label="Maximum price"
              min="0"
              onChange={(event) => updateFilter("maxPrice", event.target.value)}
              placeholder="Max"
              type="number"
              value={filters.maxPrice}
            />
            <span className="mockPriceUnit">million</span>
          </div>
          <select
            aria-label="Type"
            onChange={(event) => updateFilter("type", event.target.value)}
            value={filters.type}
          >
            <option value="">Type</option>
            {catalogTypeOptions.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <button type="submit">Filter</button>
        </form>

        {error ? <p className="mockError">{error}</p> : null}

        <section className="mockPropertyGrid">
          {isLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <div className="mockPropertyCard mockSkeleton" key={index} />
              ))
            : null}
          {!isLoading && properties.length === 0 ? (
            <div className="mockEmpty">No properties match these filters.</div>
          ) : null}
          {!isLoading
            ? properties.map((property, index) => (
                <PropertyCard
                  gradientIndex={index}
                  key={property.id}
                  property={property}
                  isSaved={savedPropertyIds.includes(property.id)}
                  isSaving={savingPropertyId === property.id}
                  onToggleSaved={toggleSavedProperty}
                />
              ))
            : null}
        </section>

        {!isLoading && totalPages > 1 ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "40px",
              paddingTop: "24px",
              borderTop: "1px solid #d8e4e8",
              flexWrap: "wrap",
              gap: "16px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#667780" }}>
              <span>Show per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #c9d9de",
                  background: "#ffffff",
                  color: "#17252c",
                  fontWeight: "600",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                <option value={10}>10 properties</option>
                <option value={20}>20 properties</option>
                <option value={50}>50 properties</option>
                <option value={100}>100 properties</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  border: "1px solid #c9d9de",
                  background: "#ffffff",
                  color: currentPage === 1 ? "#cbd5e1" : "#17252c",
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  fontWeight: "700"
                }}
              >
                ‹ Prev
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  style={{
                    minWidth: "38px",
                    height: "38px",
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: currentPage === pageNum ? "#328ba8" : "#c9d9de",
                    background: currentPage === pageNum ? "#328ba8" : "#ffffff",
                    color: currentPage === pageNum ? "#ffffff" : "#17252c",
                    fontWeight: "700",
                    cursor: "pointer"
                  }}
                >
                  {pageNum}
                </button>
              ))}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  border: "1px solid #c9d9de",
                  background: "#ffffff",
                  color: currentPage === totalPages ? "#cbd5e1" : "#17252c",
                  cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                  fontWeight: "700"
                }}
              >
                Next ›
              </button>
            </div>
          </div>
        ) : null}

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </main>
  );
}

function PropertyCard({
  gradientIndex,
  property,
  isSaved,
  isSaving,
  onToggleSaved
}: {
  gradientIndex: number;
  property: Property;
  isSaved: boolean;
  isSaving: boolean;
  onToggleSaved: (propertyId: number) => void;
}) {
  return (
    <article className="mockPropertyCard">
      <Link aria-label={`View ${property.title}`} className="propertyCardLink" href={`/properties/${property.id}`}>
        <PropertyPhoto gradientIndex={gradientIndex} property={property} />
      </Link>
      <button
        aria-label={isSaved ? "Remove from saved properties" : "Save property"}
        aria-pressed={isSaved}
        className={isSaved ? "mockHeartButton mockHeartSaved" : "mockHeartButton"}
        disabled={isSaving}
        onClick={() => onToggleSaved(property.id)}
        type="button"
      >
        <span />
      </button>
      <Link className="mockCardBody propertyCardLink" href={`/properties/${property.id}`}>
        <h2>{property.title}</h2>
        <p className="mockPrice">{formatMoney(property.price)} / month</p>
        <p className="mockMeta">
          {Number(property.area).toLocaleString("vi-VN")} sqm -{" "}
          {[property.bedroom ? `${property.bedroom} beds` : null, property.city]
            .filter(Boolean)
            .join(" - ")}
        </p>
        <p className={`mockStatus status-${property.status}`}>
          {formatStatus(property.status)}
        </p>
      </Link>
    </article>
  );
}

function PropertyPhoto({
  gradientIndex,
  property
}: {
  gradientIndex: number;
  property: Property;
}) {
  const image = property.images[0];

  if (image?.url) {
    return (
      <div
        className={`mockPropertyPhoto mockPhotoGradient mockPhotoGradient-${
          (gradientIndex % 4) + 1
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={image.alt ?? property.title}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          src={image.url}
        />
      </div>
    );
  }

  return (
    <div
      className={`mockPropertyPhoto mockPhotoGradient mockPhotoGradient-${
        (gradientIndex % 4) + 1
      }`}
    />
  );
}

function formatRegionOption(region: RegionOption) {
  return [region.name, region.district, region.city].filter(Boolean).join(" - ");
}

function applyTypeFilter(params: URLSearchParams, value: string) {
  if (!value) {
    return;
  }

  if (value === "ONE_BEDROOM") {
    params.set("minBedroom", "1");
    params.set("maxBedroom", "1");
    return;
  }

  if (value === "TWO_BEDROOM") {
    params.set("minBedroom", "2");
    params.set("maxBedroom", "2");
    return;
  }

  params.set("type", "APARTMENT");

  if (["MINI_APARTMENT", "DUPLEX", "STUDIO"].includes(value)) {
    params.set("q", value.toLowerCase().replace("_", " "));
  }
}
