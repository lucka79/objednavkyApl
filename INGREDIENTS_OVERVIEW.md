# Ingredients Overview and Invoice Upload

This new admin page provides comprehensive ingredient quantity management and invoice processing capabilities.

## Features

### 1. Ingredient Quantity Overview
- **Real-time inventory tracking**: View current stock levels for all ingredients
- **Smart filtering**: Filter by category, supplier, or stock status
- **Summary statistics**: Total items, low stock alerts, total value, average quantities
- **Status indicators**: Visual indicators for low, normal, and high stock levels
- **Low stock alerts**: Dedicated tab for items requiring immediate attention

### 2. Invoice Upload with Google Document AI
- **Multi-format support**: Upload PDF, JPG, or PNG invoices
- **Automatic parsing**: Google Document AI extracts supplier, items, quantities, and prices
- **Confidence scoring**: Shows parsing accuracy for each field
- **Manual review**: Review and edit parsed data before approval
- **Supplier assignment**: Link invoices to specific suppliers
- **Notes system**: Add comments and notes to invoices

## Components

### `IngredientQuantityOverview.tsx`
Main component displaying ingredient inventory with:
- Summary cards showing key metrics
- Filterable table with all ingredients
- Low stock alerts tab
- Search and filter functionality

### `InvoiceUploadDialog.tsx`
Modal dialog for invoice processing with:
- File upload interface
- Progress tracking during processing
- Parsed data review and editing
- Approval/rejection workflow

### `useDocumentAI.ts`
Custom hook for Google Document AI integration:
- File processing logic
- Error handling
- Mock implementation (ready for real API integration)

## Usage

1. **Access the page**: Navigate to `/admin/ingredients-overview` as an admin user
2. **View inventory**: See current stock levels and status for all ingredients
3. **Upload invoices**: Click "Nahrát fakturu" to process supplier invoices
4. **Review data**: Check parsed invoice data for accuracy
5. **Approve invoices**: Save processed invoices to update inventory

## Integration Points

### Database Integration
The component integrates with existing ingredient and supplier data:
- Uses `useIngredientStore` for ingredient data
- Uses `useSupplierUsers` for supplier information
- Ready for database integration for quantity tracking

### Google Document AI Integration
The `useDocumentAI` hook is designed for easy integration:
- Replace mock data with actual API calls
- Configure Google Cloud credentials
- Implement proper error handling
- Add authentication and authorization

## Future Enhancements

### Inventory Management
- Real-time quantity updates
- Automatic reorder points
- Supplier performance tracking
- Cost analysis and reporting

### Advanced Invoice Processing
- Batch invoice processing
- Automatic supplier matching
- Price comparison across suppliers
- Historical invoice tracking

### Reporting
- Stock level reports
- Supplier performance metrics
- Cost analysis dashboards
- Inventory valuation reports
