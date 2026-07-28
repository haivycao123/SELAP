"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RoleNavigation } from "../../components/role-navigation";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiUploadImage
} from "../../lib/api";
import {
  formatMoney,
  formatStatus,
  PROPERTY_STATUSES,
  Property,
  PropertyListResponse,
  PropertyMutationResponse,
  PropertyStatus,
  PropertyType
} from "../types";

type AuthRole = "ADMIN" | "CUSTOMER" | "SALES_AGENT" | null;

type CatalogPropertyType =
  | "ONE_BEDROOM"
  | "TWO_BEDROOM"
  | "APARTMENT"
  | "MINI_APARTMENT"
  | "DUPLEX"
  | "STUDIO";

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

type PropertyFormImage = {
  alt: string;
  sortOrder: number;
  url: string;
};

type PropertyFormState = {
  id?: number;
  title: string;
  description: string;
  type: PropertyType;
  propertyTypeChoice: CatalogPropertyType;
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

type ImageUploadResponse = {
  message: string;
  path: string;
  url: string;
};

const catalogPropertyTypeOptions: Array<{
  label: string;
  value: CatalogPropertyType;
}> = [
  { label: "1 Bedroom", value: "ONE_BEDROOM" },
  { label: "2 Bedrooms", value: "TWO_BEDROOM" },
  { label: "Apartment", value: "APARTMENT" },
  { label: "Mini Apartment", value: "MINI_APARTMENT" },
  { label: "Duplex", value: "DUPLEX" },
  { label: "Studio", value: "STUDIO" }
];

const blankForm: PropertyFormState = {
  title: "",
  description: "",
  type: "APARTMENT",
  propertyTypeChoice: "APARTMENT",
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
  images: [],
  statusChangeNote: ""
};

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

function sanitizeMoneyInput(value: string) {
  return value.replace(/\D/g, "");
}

function sanitizeDecimalInput(value: string) {
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
  return (
    <Suspense fallback={<PropertyManagementFallback />}>
      <PropertyManagementContent />
    </Suspense>
  );
}

function PropertyManagementFallback() {
  return (
    <main className="catalogMockPage managementMockPage">
      <div className="catalogMockShell">
        <RoleNavigation />
        <p className="wideNotice">Loading property management...</p>
      </div>
    </main>
  );
}

function PropertyManagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<AuthRole>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<PropertyFormState>(blankForm);
  const [search, setSearch] = useState("");
  const [includeHidden, setIncludeHidden] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedId) ?? null,
    [properties, selectedId]
  );

  const selectedRegion = useMemo(
    () => regions.find((region) => String(region.id) === form.regionId) ?? null,
    [form.regionId, regions]
  );

  useEffect(() => {
    const storedToken = localStorage.getItem("selapAccessToken");
    setToken(storedToken);
    setRole(getRoleFromToken(storedToken));
  }, []);

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
      } else if (
        editId > 0 &&
        !propertyToEdit &&
        getRoleFromToken(activeToken) === "SALES_AGENT"
      ) {
        setIsFormOpen(false);
        setSelectedId(null);
        setForm(blankForm);
        setError(
          "Sales agents can only edit or delete properties in their assigned regions."
        );
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

  const loadRegions = useCallback(async (activeToken = token) => {
    if (!activeToken) {
      return;
    }

    try {
      const response = await apiGet<RegionOptionsResponse>(
        "/properties/regions/options",
        { token: activeToken }
      );
      setRegions(response.data);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load regions."
      );
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    void loadProperties(token);
    void loadRegions(token);
  }, [token, includeHidden, loadProperties, loadRegions]);

  useEffect(() => {
    if (
      role === "SALES_AGENT" &&
      !form.id &&
      !form.regionId &&
      regions.length === 1
    ) {
      setForm((current) => ({ ...current, regionId: String(regions[0].id) }));
    }
  }, [role, regions, form.id, form.regionId]);

  function editProperty(property: Property) {
    setSelectedId(property.id);
    setIsFormOpen(true);
    setNotice("");
    setError("");
    setForm({
      id: property.id,
      title: property.title,
      description: property.description ?? "",
      type: property.type,
      propertyTypeChoice: deriveCatalogPropertyType(property),
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
      images: property.images.map((image, index) => ({
        alt: image.alt ?? "",
        sortOrder: image.sortOrder ?? index,
        url: image.url
      })),
      statusChangeNote: ""
    });
  }

  function startCreate() {
    setSelectedId(null);
    setIsFormOpen(true);
    setNotice("");
    setError("");
    setForm(blankForm);
  }

  function closeForm() {
    setSelectedId(null);
    setIsFormOpen(false);
    setForm(blankForm);
    setError("");
  }

  function updateField(name: keyof PropertyFormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateMoneyField(value: string) {
    updateField("price", sanitizeMoneyInput(value));
  }

  function updateDecimalField(name: "area", value: string) {
    updateField(name, sanitizeDecimalInput(value));
  }

  function updatePropertyTypeChoice(value: CatalogPropertyType) {
    setForm((current) => ({
      ...current,
      bedroom:
        value === "ONE_BEDROOM"
          ? "1"
          : value === "TWO_BEDROOM"
            ? "2"
            : current.bedroom,
      propertyTypeChoice: value,
      type: "APARTMENT"
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

    const payload = toPayload(form, selectedRegion);

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

      const returnTo = getSafeReturnPath(searchParams.get("returnTo"));
      if (form.id && returnTo) {
        router.push(returnTo);
        return;
      }

      await loadProperties(token);
      closeForm();
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

  async function uploadImages(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    if (!token) {
      setError("Please sign in before uploading images.");
      event.target.value = "";
      return;
    }

    setIsUploadingImage(true);
    setNotice("");
    setError("");

    try {
      const uploadedImages: PropertyFormImage[] = [];

      for (const file of files) {
        const response = await apiUploadImage<ImageUploadResponse>(
          "/properties/uploads/images",
          { file, token }
        );

        uploadedImages.push({
          alt: file.name,
          sortOrder: 0,
          url: response.url
        });
      }

      setForm((current) => ({
        ...current,
        images: [...current.images, ...uploadedImages].map((image, index) => ({
          ...image,
          sortOrder: index
        }))
      }));
      setNotice(`${uploadedImages.length} image(s) uploaded successfully.`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to upload image."
      );
    } finally {
      setIsUploadingImage(false);
      event.target.value = "";
    }
  }

  function removeImage(index: number) {
    setForm((current) => ({
      ...current,
      images: current.images
        .filter((_, imageIndex) => imageIndex !== index)
        .map((image, imageIndex) => ({ ...image, sortOrder: imageIndex }))
    }));
  }

  function updateImageAlt(index: number, value: string) {
    setForm((current) => ({
      ...current,
      images: current.images.map((image, imageIndex) =>
        imageIndex === index ? { ...image, alt: value } : image
      )
    }));
  }

  return (
    <main className="catalogMockPage managementMockPage">
      <div className="catalogMockShell">
        <RoleNavigation />

        {!isFormOpen ? (
          <section className="managementHeader">
            <div>
              <p className="eyebrow">Property Management</p>
              <h1>Inventory control</h1>
            </div>
            <button className="primaryButton compactButton" onClick={startCreate}>
              New Property
            </button>
          </section>
        ) : null}

        {!token ? (
          <p className="errorNotice wideNotice">
            Please sign in as Admin or Sales Agent to manage properties.
          </p>
        ) : null}
        {notice ? <p className="successNotice wideNotice">{notice}</p> : null}
        {error ? <p className="errorNotice wideNotice">{error}</p> : null}

        <section className={isFormOpen ? "propertyScreenFormWrap" : "managementGrid managementListGrid"}>
          {!isFormOpen ? (
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
                                {property.type} - {Number(property.area)} m2
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
          ) : null}

          {isFormOpen ? (
            <form className="propertyScreenPanel" onSubmit={saveProperty}>
              <div className="formHeading">
                <div>
                  <h2>{selectedProperty?.title ?? "Add New Property"}</h2>
                </div>
              </div>

              <div className="propertyFormColumns">
                <section className="propertyFormColumn">
                  <h3>Basic Information</h3>
                  <Field label="Property Title">
                    <input
                      onChange={(event) => updateField("title", event.target.value)}
                      placeholder="River Park Residence A1204"
                      required
                      value={form.title}
                    />
                  </Field>
                  <div className="propertyFormPair propertyFormSingle">
                    <Field label="Property Type">
                      <select
                        onChange={(event) =>
                          updatePropertyTypeChoice(
                            event.target.value as CatalogPropertyType
                          )
                        }
                        value={form.propertyTypeChoice}
                      >
                        {catalogPropertyTypeOptions.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="propertyFormPair propertyFormPairWide">
                    <Field label="Address / Area">
                      <input
                        onChange={(event) => updateField("address", event.target.value)}
                        placeholder="Thu Duc"
                        required
                        value={form.address}
                      />
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
                  </div>
                  <label className="propertyTextareaField">
                    <span>Description</span>
                    <textarea
                      onChange={(event) =>
                        updateField("description", event.target.value)
                      }
                      placeholder="Balcony, city view, parking, shared pool..."
                      rows={3}
                      value={form.description}
                    />
                  </label>
                </section>

                <section className="propertyFormColumn">
                  <h3>Price, Status and Media</h3>
                  <div className="propertyMetricGrid">
                    <Field label="Price">
                      <input
                        inputMode="numeric"
                        onChange={(event) => updateMoneyField(event.target.value)}
                        pattern="[0-9]*"
                        placeholder="18000000"
                        required
                        value={form.price}
                      />
                    </Field>
                    <Field label="Area">
                      <input
                        inputMode="decimal"
                        onChange={(event) => updateDecimalField("area", event.target.value)}
                        pattern="[0-9]*[.]?[0-9]*"
                        placeholder="72"
                        required
                        value={form.area}
                      />
                    </Field>
                    <Field label="Bedrooms">
                      <input
                        min="0"
                        onChange={(event) => updateField("bedroom", event.target.value)}
                        type="number"
                        value={form.bedroom}
                      />
                    </Field>
                  </div>
                  <Field label="Region">
                    <select
                      onChange={(event) =>
                        updateField("regionId", event.target.value)
                      }
                      required={role === "SALES_AGENT"}
                      value={form.regionId}
                    >
                      <option value="">Select region</option>
                      {regions.map((region) => (
                        <option key={region.id} value={region.id}>
                          {formatRegionOption(region)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <label className="propertyUploadField">
                    <span>Photo / Video Library</span>
                    <div className="propertyUploadDropzone">
                      <input
                        accept="image/*"
                        disabled={isUploadingImage}
                        multiple
                        onChange={uploadImages}
                        type="file"
                      />
                      <strong>+</strong>
                      <small>
                        {isUploadingImage
                          ? "Uploading images..."
                          : "Drag images here or click to upload"}
                      </small>
                    </div>
                  </label>
                  {form.images.length > 0 ? (
                    <div className="imageGalleryField">
                      {form.images.map((image, index) => (
                        <div className="imageGalleryItem" key={`${image.url}-${index}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt={image.alt || `Property image ${index + 1}`}
                            src={image.url}
                          />
                          <input
                            aria-label={`Image ${index + 1} alt text`}
                            onChange={(event) =>
                              updateImageAlt(index, event.target.value)
                            }
                            placeholder="Image alt text"
                            value={image.alt}
                          />
                          <button
                            className="dangerButton miniButton"
                            onClick={() => removeImage(index)}
                            type="button"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <Field label="Status Note">
                    <input
                      onChange={(event) =>
                        updateField("statusChangeNote", event.target.value)
                      }
                      placeholder="Only needed when status changes"
                      value={form.statusChangeNote}
                    />
                  </Field>
                </section>
              </div>

              <div className="formActions">
                <button className="mutedButton" onClick={closeForm} type="button">
                  Cancel
                </button>
                <button className="outlineButton" type="button">
                  Save Draft
                </button>
                <button className="primaryButton compactButton" disabled={isSaving}>
                  {isSaving ? "Saving..." : form.id ? "Save Changes" : "Create"}
                </button>
              </div>
            </form>
          ) : null}
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

function formatRegionOption(region: RegionOption) {
  return [region.name, region.district, region.city].filter(Boolean).join(" - ");
}

function toPayload(form: PropertyFormState, region: RegionOption | null) {
  const propertyTypeMapping = mapCatalogPropertyType(form);
  const payload: Record<string, unknown> = {
    address: form.address,
    area: form.area,
    bedroom: propertyTypeMapping.bedroom,
    bathroom: optionalNumber(form.bathroom),
    city: region?.city ?? form.city,
    description: form.description || undefined,
    district: region?.district ?? form.district,
    floor: optionalNumber(form.floor),
    price: form.price,
    regionId: optionalNumber(form.regionId),
    status: form.status,
    statusChangeNote: form.statusChangeNote || undefined,
    title: form.title,
    type: propertyTypeMapping.type,
    ward: (region?.ward ?? form.ward) || undefined
  };

  if (form.images.length > 0) {
    payload.images = form.images.map((image, index) => ({
      alt: image.alt || undefined,
      sortOrder: index,
      url: image.url
    }));
  }

  return payload;
}

function optionalNumber(value: string) {
  return value === "" ? undefined : Number(value);
}

function getSafeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

function deriveCatalogPropertyType(property: Property): CatalogPropertyType {
  if (property.bedroom === 1) {
    return "ONE_BEDROOM";
  }

  if (property.bedroom === 2) {
    return "TWO_BEDROOM";
  }

  return "APARTMENT";
}

function mapCatalogPropertyType(form: PropertyFormState) {
  if (form.propertyTypeChoice === "ONE_BEDROOM") {
    return { bedroom: 1, type: "APARTMENT" as PropertyType };
  }

  if (form.propertyTypeChoice === "TWO_BEDROOM") {
    return { bedroom: 2, type: "APARTMENT" as PropertyType };
  }

  return {
    bedroom: optionalNumber(form.bedroom),
    type: "APARTMENT" as PropertyType
  };
}
