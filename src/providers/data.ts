import type { DataProvider } from "@refinedev/core";
import mockData from "../mocks.json";

export type MockDataShape = {
  [resourceName: string]: Array<{
    id: number;
    [field: string]: any;
  }>;
};

// Real data provider for Spoolman API
const createRealDataProvider = (apiUrl: string): DataProvider => {
  return {
    getList: async ({ resource, pagination }) => {
      const url = `${apiUrl}/${resource}`;

      console.log(`[DataProvider] 🌐 Fetching ${resource} from:`, url);

      const response = await fetch(url);

      if (!response.ok) {
        console.error(`[DataProvider] ❌ HTTP error ${response.status} for ${resource}`);
        throw new Error(`HTTP error ${response.status}`);
      }

      let data = await response.json();

      console.log(`[DataProvider] ✅ Raw response for ${resource}:`, data);

      // CRITICAL: Spoolman's /api/v1/location returns string array, not objects
      // Transform string array to objects with id and name
      if (resource === "location" && Array.isArray(data)) {
        const isStringArray = data.length > 0 && typeof data[0] === "string";

        if (isStringArray) {
          console.log(`[DataProvider] 🔄 Transforming location string array to objects...`);
          data = data.map((locationName: string, index: number) => ({
            id: index + 1, // Generate sequential IDs
            name: locationName,
          }));
          console.log(`[DataProvider] ✅ Transformed locations:`, data);
        }
      }

      console.log(`[DataProvider] 📊 ${resource} count:`, data?.length ?? 0);

      return {
        data: data,
        total: data.length,
      };
    },

    create: async ({ resource, variables }) => {
      const url = `${apiUrl}/${resource}`;

      console.log(`[DataProvider] 📝 Creating ${resource}:`, variables);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(variables),
      });

      const data = await response.json();

      console.log(`[DataProvider] ✅ Created ${resource}:`, data);

      return {
        data,
      };
    },

    update: async ({ resource, id, variables }) => {
      const url = `${apiUrl}/${resource}/${id}`;

      console.log(`[DataProvider] 🔄 Updating ${resource} ${id}:`, variables);

      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(variables),
      });

      const data = await response.json();

      console.log(`[DataProvider] ✅ Updated ${resource} ${id}:`, data);

      return {
        data,
      };
    },

    deleteOne: async ({ resource, id }) => {
      const url = `${apiUrl}/${resource}/${id}`;

      const response = await fetch(url, {
        method: "DELETE",
      });

      const data = await response.json();

      return {
        data,
      };
    },

    getOne: async ({ resource, id }) => {
      const url = `${apiUrl}/${resource}/${id}`;

      const response = await fetch(url);
      const data = await response.json();

      return {
        data,
      };
    },

    getApiUrl: () => apiUrl,
  };
};

// Mock data provider
const createMockDataProvider = (): DataProvider => {
  const data: MockDataShape = mockData as any;

  return {
    getList: async ({ resource, pagination, filters, sorters }) => {
      let items = [...(data[resource] || [])];

      // Handle filters
      if (filters) {
        items = items.filter((item) => {
          return filters.every((filter) => {
            if (!filter.value) return true;

            const value = "field" in filter ? item[filter.field] : null;

            switch (filter.operator) {
              case "eq":
                return value === filter.value;
              case "ne":
                return value !== filter.value;
              case "lt":
                return value && value < filter.value;
              case "gt":
                return value && value > filter.value;
              case "lte":
                return value && value <= filter.value;
              case "gte":
                return value && value >= filter.value;
              case "contains":
                return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
              default:
                return true;
            }
          });
        });
      }

      // Handle sorting
      if (sorters && sorters.length > 0) {
        items = items.sort((a, b) => {
          for (const sorter of sorters) {
            const result =
              String(a[sorter.field]).localeCompare(String(b[sorter.field])) * (sorter.order === "desc" ? -1 : 1);

            if (result !== 0) return result;
          }
          return 0;
        });
      }

      // Handle pagination
      const total = items.length;
      if (pagination) {
        const start = ((pagination.current ?? 1) - 1) * (pagination.pageSize ?? 10);
        const end = start + (pagination.pageSize ?? 10);
        items = items.slice(start, end);
      }

      return {
        data: items as any,
        total,
      };
    },

    getOne: async ({ resource, id }) => {
      const item = (data[resource] || []).find((item) => String(item.id) === String(id));

      if (!item) {
        throw new Error(`Item with id "${id}" not found in "${resource}"`);
      }

      return {
        data: item as any,
      };
    },

    create: async ({ resource, variables }) => {
      const newItem = {
        id: Math.max(...data[resource].map((item) => Number(item.id))) + 1,
        ...variables,
      };

      data[resource].push(newItem);

      return {
        data: newItem as any,
      };
    },

    update: async ({ resource, id, variables }) => {
      const index = data[resource].findIndex((item) => String(item.id) === String(id));

      if (index === -1) {
        throw new Error(`Item with id "${id}" not found in "${resource}"`);
      }

      const updatedItem = {
        ...data[resource][index],
        ...variables,
      };

      data[resource][index] = updatedItem;

      return {
        data: updatedItem as any,
      };
    },

    deleteOne: async ({ resource, id }) => {
      const index = data[resource].findIndex((item) => String(item.id) === String(id));

      if (index === -1) {
        throw new Error(`Item with id "${id}" not found in "${resource}"`);
      }

      const deletedItem = data[resource][index];
      data[resource].splice(index, 1);

      return {
        data: deletedItem as any,
      };
    },

    getMany: async ({ resource, ids }) => {
      const items = (data[resource] || []).filter((item) => ids.map((id) => String(id)).includes(String(item.id)));

      return {
        data: items as any,
      };
    },

    getApiUrl: () => "",

    custom: async () => ({
      data: {} as any,
    }),
  };
};

// Main data provider factory that switches between mock and real data
export const createDataProvider = (useMock: boolean = false, apiUrl?: string): DataProvider => {
  console.log("Creating data provider - useMock:", useMock, "apiUrl:", apiUrl);

  // If using mock data, return mock provider
  if (useMock) {
    console.log("Using mock data provider");
    return createMockDataProvider();
  }

  // If not using mock and apiUrl is provided, use real data provider
  if (apiUrl) {
    console.log("Using real data provider with URL:", apiUrl);
    return createRealDataProvider(apiUrl);
  }

  // Default to mock if no valid configuration
  console.log("Defaulting to mock data provider");
  return createMockDataProvider();
};
