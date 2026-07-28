"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RoleNavigation } from "../../components/role-navigation";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../lib/api";
import {
  formatMoney,
  formatStatus,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  Property,
  PropertyListResponse,
  PropertyMutationResponse,
  PropertyStatus,
  PropertyType
} from "../types";

type PropertyFormImage = {
  url: string;
  alt: string;
};

type PropertyFormState = {
  id?: number;
  title: string;
  description: string;
  type: PropertyType;
  status: PropertyStatus;
  price: string;
  area: string;
  address: string;
  city: string;
  district: string;
  ward: string;
  bedroom: string;
  bathroom: string;
  floor: string;
  regionId: string;
  images: PropertyFormImage[];
  statusChangeNote: string;
};

type AuthRole = "ADMIN" | "CUSTOMER" | "SALES_AGENT" | null;

type RegionOption = {
  id: number;
  label: string;
};

const blankImageRow: PropertyFormImage = { url: "", alt: "" };

const blankForm: PropertyFormState = {
  title: "",
  description: "",
  type: "APARTMENT",
  status: "AVAILABLE",
  price: "",
  area: "",
  address: "",
  city: "",
  district: "",
  ward: "",
  bedroom: "",
  bathroom: "",
  floor: "",
  regionId: "",
  images: [{ ...blankImageRow }],
  statusChangeNote: ""
};

function regionLabel(region: {
  name: string;
  district?: string | null;
  city?: string | null;
}) {
  return [region.name, region.district, region.city].filter(Boolean).join(" - ");
}

function getRoleFromToken(token: string | null): AuthRole {
  if (!token) return null;
  try {
    const value = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(
      window.atob(value.padEnd(Math.ceil(value.length / 4) * 4, "="))
    ) as { role?: AuthRole };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

function sanitizeNumericInput(value: string) {
  let cleaned = value.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  return cleaned;
}

export default function PropertyManagementPage() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<AuthRole>(null);
  const [adminRegions, setAdminRegions] = useState<RegionOption[]>([]);
  const [agentRegions, setAgentRegions] = useState<RegionOption[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<PropertyFormState>(blankForm);
  const [search, setSearch] = useState("");
  const [includeHidden, setIncludeHidden] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedId) ?? null,
    [properties, selectedId]
  );

  useEffect(() => {
    setToken(localStorage.getItem("selapAccessToken"));
  }, []);

  useEffect(() => {
    if (!token) {
      setRole(null);
      return;
    }

    const currentRole = getRoleFromToken(token);
    setRole(currentRole);

    if (currentRole === "ADMIN") {
      apiGet<{ data: Array<{ id: number; name: string; district: string | null; city: string | null }> }>(
        "/admin/regions",
        { token }
      )
        .then((response) => {
          setAdminRegions(
            response.data.map((region) => ({ id: region.id, label: regionLabel(region) }))
          );
        })
        .catch(() => undefined);
    } else if (currentRole === "SALES_AGENT") {
      apiGet<{
        user: {
          regions: Array<{ id: number; name: string; district: string | null; city: string | null }>;
        };
      }>("/auth/me", { token })
        .then((response) => {
          setAgentRegions(
            response.user.regions.map((region) => ({ id: region.id, label: regionLabel(region) }))
          );
        })
        .catch(() => undefined);
    }
  }, [token]);

  const loadProperties = useCallback(async (activeToken = token) => {
    if (!activeToken) {
      return;
    }

    setIsLoading(true);
    setError("");

    const params = new URLSearchParams({
      includeHidden: String(includeHidden),
      limit: "100",
      sortBy: "createdAt",
      sortOrder: "desc"
    });

    if (search.trim()) {
      params.set("q", search.trim());
    }

    try {
      const response = await apiGet<PropertyListResponse>(
        `/properties/manage?${params.toString()}`,
        { token: activeToken }
      );
      setProperties(response.data);

      const editId = Number(searchParams.get("edit"));
      const propertyToEdit = response.data.find((property) => property.id === editId);
      if (propertyToEdit && selectedId !== editId) {
        editProperty(propertyToEdit);
      }

      if (selectedId && !response.data.some((item) => item.id === selectedId)) {
        setSelectedId(null);
        setForm(blankForm);
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load properties."
      );
    } finally {
      setIsLoading(false);
    }
  }, [includeHidden, search, searchParams, selectedId, token]);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    void loadProperties(token);
  }, [token, includeHidden, loadProperties]);

  useEffect(() => {
    if (
      role === "SALES_AGENT" &&
      !form.id &&
      !form.regionId &&
      agentRegions.length === 1
    ) {
      setForm((current) => ({ ...current, regionId: String(agentRegions[0].id) }));
    }
  }, [role, agentRegions, form.id, form.regionId]);

  function editProperty(property: Property) {
    setSelectedId(property.id);
    setNotice("");
    setError("");
    setForm({
      id: property.id,
      title: property.title,
      description: property.description ?? "",
      type: property.type,
      status: property.status,
      price: String(Number(property.price)),
      area: String(Number(property.area)),
      address: property.address,
      city: property.city,
      district: property.district,
      ward: property.ward ?? "",
      bedroom: property.bedroom === null ? "" : String(property.bedroom ?? ""),
      bathroom:
        property.bathroom === null ? "" : String(property.bathroom ?? ""),
      floor: property.floor === null ? "" : String(property.floor ?? ""),
      regionId: property.regionId === null ? "" : String(property.regionId ?? ""),
      images:
        property.images.length > 0
          ? property.images.map((image) => ({ url: image.url, alt: image.alt ?? "" }))
          : [{ ...blankImageRow }],
      statusChangeNote: ""
    });
  }

  function startCreate() {
    setSelectedId(null);
    setNotice("");
    setError("");
    setForm(blankForm);
  }

  function updateField(name: keyof PropertyFormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateNumericField(name: "price" | "area", value: string) {
    updateField(name, sanitizeNumericInput(value));
  }

  function updateImageField(index: number, field: "url" | "alt", value: string) {
    setForm((current) => ({
      ...current,
      images: current.images.map((image, imageIndex) =>
        imageIndex === index ? { ...image, [field]: value } : image
      )
    }));
  }

  function addImageRow() {
    setForm((current) => ({
      ...current,
      images: [...current.images, { ...blankImageRow }]
    }));
  }

  function removeImageRow(index: number) {
    setForm((current) => ({
      ...current,
      images:
        current.images.length > 1
          ? current.images.filter((_, imageIndex) => imageIndex !== index)
          : [{ ...blankImageRow }]
    }));
  }

  async function saveProperty(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("Please sign in before managing properties.");
      return;
    }

    setIsSaving(true);
    setNotice("");
    setError("");

    const payload = toPayload(form);

    try {
      const response = form.id
        ? await apiPatch<PropertyMutationResponse>(`/properties/${form.id}`, {
            body: payload,
            token
          })
        : await apiPost<PropertyMutationResponse>("/properties", {
            body: payload,
            token
          });

      setNotice(response.message);
      await loadProperties(token);

      if (response.property) {
        editProperty(response.property);
      } else if (!form.id) {
        startCreate();
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save property."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteProperty(property: Property) {
    if (!token) {
      setError("Please sign in before managing properties.");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${property.title}"? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setNotice("");
    setError("");

    try {
      const response = await apiDelete<PropertyMutationResponse>(
        `/properties/${property.id}`,
        { token }
      );
      setNotice(response.message);
      setSelectedId(null);
      setForm(blankForm);
      await loadProperties(token);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete property."
      );
    }
  }

  return (
    <main className="catalogMockPage managementMockPage">
      <div className="catalogMockShell">
        <RoleNavigation />

      <section className="managementHeader">
        <div>
          <p className="eyebrow">Property Management</p>
          <h1>Inventory control</h1>
        </div>
        <button className="primaryButton compactButton" onClick={startCreate}>
          New Property
        </button>
      </section>

      {!token ? (
        <p className="errorNotice wideNotice">
          Please sign in as Admin or Sales Agent to manage properties.
        </p>
      ) : null}
      {notice ? <p className="successNotice wideNotice">{notice}</p> : null}
      {error ? <p className="errorNotice wideNotice">{error}</p> : null}

      <section className="managementGrid">
        <div className="tablePanel">
          <div className="tableToolbar">
            <label>
              <span>Search inventory</span>
              <input
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void loadProperties();
                  }
                }}
                placeholder="Title, address, city..."
                value={search}
              />
            </label>
            <label className="checkControl">
              <input
                checked={includeHidden}
                onChange={(event) => setIncludeHidden(event.target.checked)}
                type="checkbox"
              />
              Include hidden
            </label>
            <button className="outlineButton" onClick={() => loadProperties()}>
              Refresh
            </button>
          </div>

          <div className="propertyTableWrap">
            <table className="propertyTable">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Location</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5}>Loading properties...</td>
                  </tr>
                ) : null}
                {!isLoading && properties.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No properties found.</td>
                  </tr>
                ) : null}
                {!isLoading
                  ? properties.map((property) => (
                      <tr
                        className={
                          property.id === selectedId ? "selectedRow" : ""
                        }
                        key={property.id}
                      >
                        <td>
                          <strong>{property.title}</strong>
                          <span>
                            {property.type} · {Number(property.area)} m2
                          </span>
                        </td>
                        <td>
                          {property.district}, {property.city}
                        </td>
                        <td>{formatMoney(property.price)}</td>
                        <td>
                          <span
                            className={`statusPill status-${property.status}`}
                          >
                            {formatStatus(property.status)}
                          </span>
                        </td>
                        <td>
                          <div className="rowActions">
                            <button
                              className="outlineButton miniButton"
                              onClick={() => editProperty(property)}
                              type="button"
                            >
                              Edit
                            </button>
                            <button
                              className="dangerButton miniButton"
                              onClick={() => deleteProperty(property)}
                              type="button"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  : null}
              </tbody>
            </table>
          </div>
        </div>

        <form className="editPanel" onSubmit={saveProperty}>
          <div className="formHeading">
            <div>
              <p className="eyebrow">{selectedProperty ? "Edit" : "Create"}</p>
              <h2>{selectedProperty?.title ?? "New property"}</h2>
            </div>
            <span className="recordBadge">
              {form.id ? `ID ${form.id}` : "Draft"}
            </span>
          </div>

          <div className="formGrid">
            <Field label="Title">
              <input
                onChange={(event) => updateField("title", event.target.value)}
                required
                value={form.title}
              />
            </Field>
            <Field label="Type">
              <select
                onChange={(event) =>
                  updateField("type", event.target.value as PropertyType)
                }
                value={form.type}
              >
                {PROPERTY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                onChange={(event) =>
                  updateField("status", event.target.value as PropertyStatus)
                }
                value={form.status}
              >
                {PROPERTY_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Region">
              {role === "ADMIN" ? (
                <select
                  onChange={(event) => updateField("regionId", event.target.value)}
                  value={form.regionId}
                >
                  <option value="">Select area...</option>
                  {adminRegions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.label}
                    </option>
                  ))}
                </select>
              ) : agentRegions.length > 1 ? (
                <select
                  onChange={(event) => updateField("regionId", event.target.value)}
                  value={form.regionId}
                >
                  <option value="">Select area...</option>
                  {agentRegions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  disabled
                  value={
                    agentRegions[0]?.label ?? "No area assigned yet. Contact admin."
                  }
                />
              )}
            </Field>
            <Field label="Price">
              <input
                inputMode="decimal"
                onChange={(event) => updateNumericField("price", event.target.value)}
                placeholder="0"
                required
                value={form.price}
              />
            </Field>
            <Field label="Area">
              <input
                inputMode="decimal"
                onChange={(event) => updateNumericField("area", event.target.value)}
                placeholder="0"
                required
                value={form.area}
              />
            </Field>
            <Field label="City">
              <input
                onChange={(event) => updateField("city", event.target.value)}
                required
                value={form.city}
              />
            </Field>
            <Field label="District">
              <input
                onChange={(event) => updateField("district", event.target.value)}
                required
                value={form.district}
              />
            </Field>
            <Field label="Ward">
              <input
                onChange={(event) => updateField("ward", event.target.value)}
                value={form.ward}
              />
            </Field>
            <Field label="Address">
              <input
                onChange={(event) => updateField("address", event.target.value)}
                required
                value={form.address}
              />
            </Field>
            <Field label="Bedroom">
              <input
                min="0"
                onChange={(event) => updateField("bedroom", event.target.value)}
                type="number"
                value={form.bedroom}
              />
            </Field>
            <Field label="Bathroom">
              <input
                min="0"
                onChange={(event) => updateField("bathroom", event.target.value)}
                type="number"
                value={form.bathroom}
              />
            </Field>
            <Field label="Floor">
              <input
                min="0"
                onChange={(event) => updateField("floor", event.target.value)}
                type="number"
                value={form.floor}
              />
            </Field>
            <div className="fullField imageFieldGroup">
              <span>Images</span>
              {form.images.map((image, index) => (
                <div className="imageFieldRow" key={index}>
                  <input
                    onChange={(event) => updateImageField(index, "url", event.target.value)}
                    placeholder="Image URL"
                    value={image.url}
                  />
                  <input
                    onChange={(event) => updateImageField(index, "alt", event.target.value)}
                    placeholder="Alt text"
                    value={image.alt}
                  />
                  <button
                    className="dangerButton miniButton"
                    onClick={() => removeImageRow(index)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                className="outlineButton miniButton"
                onClick={addImageRow}
                type="button"
              >
                + Add image
              </button>
            </div>
            <Field label="Status Note">
              <input
                onChange={(event) =>
                  updateField("statusChangeNote", event.target.value)
                }
                placeholder="Only needed when status changes"
                value={form.statusChangeNote}
              />
            </Field>
            <label className="fullField">
              <span>Description</span>
              <textarea
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                rows={4}
                value={form.description}
              />
            </label>
          </div>

          <div className="formActions">
            <button className="primaryButton compactButton" disabled={isSaving}>
              {isSaving ? "Saving..." : form.id ? "Save Changes" : "Create"}
            </button>
            <button className="outlineButton" onClick={startCreate} type="button">
              Clear
            </button>
          </div>
        </form>
      </section>
      </div>
    </main>
  );
}

function Field({
  children,
  label
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label>
      <span>{label}</span>
      {children}
    </label>
  );
}

function toPayload(form: PropertyFormState) {
  const payload: Record<string, unknown> = {
    address: form.address,
    area: Number(form.area),
    bathroom: optionalNumber(form.bathroom),
    bedroom: optionalNumber(form.bedroom),
    city: form.city,
    description: form.description || undefined,
    district: form.district,
    floor: optionalNumber(form.floor),
    price: Number(form.price),
    regionId: optionalNumber(form.regionId),
    status: form.status,
    statusChangeNote: form.statusChangeNote || undefined,
    title: form.title,
    type: form.type,
    ward: form.ward || undefined
  };

  const images = form.images
    .filter((image) => image.url.trim())
    .map((image, index) => ({
      alt: image.alt || undefined,
      sortOrder: index,
      url: image.url.trim()
    }));

  if (images.length > 0) {
    payload.images = images;
  }

  return payload;
}

function optionalNumber(value: string) {
  return value === "" ? undefined : Number(value);
}
