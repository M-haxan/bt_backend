# Frontend API Documentation - Balouch Tailors

This document provides all the necessary details for the frontend developer to integrate the **Customer** and **Measurement Template** functionalities.

---

## 🔒 Important Note on Authentication (CORS & Cookies)
All the routes below are protected by an authentication middleware (`protect`). The frontend must ensure that:
1. The admin is logged in before calling these APIs.
2. Axios or Fetch is configured to send cookies with requests (e.g., `withCredentials: true` in Axios) since the JWT token is stored in cookies.

---

## 📐 1. Measurement Template APIs
Base URL: `/api/template`

### A. Create a New Template
*   **Method:** `POST`
*   **Endpoint:** `/api/template`
*   **Description:** Creates a new measurement category (e.g., Shalwar Kameez) along with its specific input fields.
*   **Request Body:**
    ```json
    {
      "categoryname": "Shalwar Kameez",
      "fields": ["Length", "Chest", "Waist", "Sleeve", "Collar"]
    }
    ```
*   **Success Response (201 Created):** Returns the created template object.

### B. Get All Templates
*   **Method:** `GET`
*   **Endpoint:** `/api/template`
*   **Description:** Fetches all available templates. Use this to render the dynamic forms when creating or updating a customer.
*   **Success Response (200 OK):**
    ```json
    [
      {
        "_id": "64abcdef1234567890",
        "categoryname": "Shalwar Kameez",
        "fields": ["Length", "Chest", "Waist", "Sleeve", "Collar"]
      },
      ...
    ]
    ```

### C. Update a Template
*   **Method:** `PUT`
*   **Endpoint:** `/api/template/:id`
*   **Description:** Updates the name or fields of an existing template.
*   **Request Body:**
    ```json
    {
      "categoryname": "Shalwar Kameez Updated",
      "fields": ["Length", "Chest", "Waist", "Sleeve", "Collar", "Bottom"]
    }
    ```
*   **Success Response (200 OK):** Returns the updated template object.

### D. Delete a Template
*   **Method:** `DELETE`
*   **Endpoint:** `/api/template/:id`
*   **Description:** Deletes a specific template by its ID.
*   **Success Response (200 OK):** Returns the deleted template object.

---

## 👥 2. Customer APIs
Base URL: `/api/customer`

### A. Create a Customer (With Initial Measurements)
*   **Method:** `POST`
*   **Endpoint:** `/api/customer`
*   **Description:** Creates a new customer along with their measurements based on a selected template.
*   **Request Body:**
    *   **Note:** The `data` object should dynamically take keys from the Template's `fields` array.
    ```json
    {
      "name": "Ali Raza",
      "phone": 923001234567,
      "address": "Lahore, Pakistan",
      "measurements": [
        {
          "category": "Shalwar Kameez",
          "data": {
            "Length": "40",
            "Chest": "22",
            "Waist": "20",
            "Sleeve": "24",
            "Collar": "15.5"
          }
        }
      ]
    }
    ```
*   **Success Response (201 Created):** Returns the newly created customer object.

### B. Get All Customers
*   **Method:** `GET`
*   **Endpoint:** `/api/customer`
*   **Description:** Fetches a list of all customers.
*   **Success Response (200 OK):** Returns an array of customer objects.

### C. Get Customer by ID
*   **Method:** `GET`
*   **Endpoint:** `/api/customer/:id`
*   **Description:** Fetches a specific customer's full profile including their measurements. Use this to pre-fill the form on the update page.
*   **Success Response (200 OK):** Returns the customer object.

### D. Update Customer Basic Info
*   **Method:** `PUT`
*   **Endpoint:** `/api/customer/:id`
*   **Description:** Updates ONLY the basic information of the customer (name, phone, address).
*   **Request Body:**
    ```json
    {
      "name": "Ali Raza Updated",
      "phone": 923001234567,
      "address": "Karachi, Pakistan"
    }
    ```
*   **Success Response (200 OK):** Returns the updated customer object.

### E. Update/Add Customer Measurements
*   **Method:** `PUT`
*   **Endpoint:** `/api/customer/:id/measurements`
*   **Description:** Updates the customer's measurements. This can be used to edit existing measurements OR add a new category (e.g., adding "Shirt" measurements).
*   **⚠️ CRITICAL UI INSTRUCTION:** The backend `replaces` the entire measurements array. When sending this request, the frontend **must send the complete array of measurements**, including both existing unchanged categories and the newly added/updated categories. If you only send the new one, the old ones will be deleted!
*   **Request Body:**
    ```json
    {
      "measurements": [
        {
          "category": "Shalwar Kameez",
          "data": {
            "Length": "40",
            "Chest": "22.5" 
          }
        },
        {
          "category": "Shirt",
          "data": {
            "Length": "28",
            "Chest": "21"
          }
        }
      ]
    }
    ```
*   **Success Response (200 OK):** Returns the updated customer object.

### F. Delete a Customer
*   **Method:** `DELETE`
*   **Endpoint:** `/api/customer/:id`
*   **Description:** Deletes a specific customer by their ID.
*   **Success Response (200 OK):** Returns the deleted customer object.
