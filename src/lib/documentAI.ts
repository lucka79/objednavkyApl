// Google Document AI integration service
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

// interface DocumentAIProcessor {
//   name: string;
//   displayName: string;
//   processorId: string;
// }

interface ProcessedDocument {
  supplier: string;
  invoiceNumber: string;
  date: string;
  totalAmount: number;
  confidence: number;
  items: Array<{
    name: string;
    quantity: number;
    unit: string;
    price: number;
    total: number;
    supplierCode?: string;
    confidence: number;
  }>;
}

export class DocumentAIService {
  private client: DocumentProcessorServiceClient;
  private projectId: string;
  private location: string;
  private bakeryProcessorId: string;

  constructor() {
    this.client = new DocumentProcessorServiceClient();
    this.projectId = '832370309522';
    this.location = 'eu';
    this.bakeryProcessorId = 'b5de41a4cf52cc70';
  }

  /**
   * Process document with specific parser based on supplier
   */
  async processDocument(
    file: File, 
    supplierId: string
  ): Promise<ProcessedDocument> {
    try {
      // Determine processor based on supplier
      const processorId = this.getProcessorId(supplierId);
      
      // Convert file to bytes
      const fileBytes = await this.fileToBytes(file);
      
      // Create the request with EU region
      const request = {
        name: `projects/${this.projectId}/locations/${this.location}/processors/${processorId}`,
        rawDocument: {
          content: fileBytes,
          mimeType: file.type,
        },
      };

      console.log(`Processing document with processor: ${processorId} in region: ${this.location}`);

      // Process the document
      const [result] = await this.client.processDocument(request);
      
      // Parse the response based on the processor type
      return await this.parseDocumentResponse(result, supplierId);
      
    } catch (error) {
      console.error('Document AI processing error:', error);
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get processor ID based on supplier
   */
  private getProcessorId(supplierId: string): string {
    if (supplierId === 'pesek-rambousek') {
      return this.bakeryProcessorId;
    }
    
    // For other suppliers, you can add more processors here
    return this.bakeryProcessorId;
  }

  /**
   * Convert file to bytes
   */
  private async fileToBytes(file: File): Promise<Uint8Array> {
    const arrayBuffer = await file.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  /**
   * Parse Document AI response based on processor type
   */
  private async parseDocumentResponse(result: any, supplierId: string): Promise<ProcessedDocument> {
    const document = result.document;
    
    if (supplierId === 'pesek-rambousek') {
      return await this.parseBakeryAplicaResponse(document);
    } else {
      return this.parseDefaultInvoiceResponse(document);
    }
  }

  /**
   * Parse response from bakery_aplica_parser
   */
  private async parseBakeryAplicaResponse(document: any): Promise<ProcessedDocument> {
    console.log('Parsing bakery_aplica_parser response:', JSON.stringify(document, null, 2));
    
    // Extract entities from the document
    const entities = document.entities || [];
    
    // Find specific entities with multiple possible field names
    const supplier = this.findEntity(entities, 'supplier_name') || 
                    this.findEntity(entities, 'vendor_name') || 
                    this.findEntity(entities, 'company_name') || 
                    'Pešek - Rambousek';
    
    const invoiceNumber = this.findEntity(entities, 'invoice_number') || 
                         this.findEntity(entities, 'document_number') || 
                         this.findEntity(entities, 'invoice_id') || 
                         '';
    
    const date = this.findEntity(entities, 'invoice_date') || 
                 this.findEntity(entities, 'document_date') || 
                 this.findEntity(entities, 'date') || 
                 new Date().toISOString().split('T')[0];
    
    const totalAmount = parseFloat(this.findEntity(entities, 'total_amount') || 
                                  this.findEntity(entities, 'net_amount') || 
                                  this.findEntity(entities, 'grand_total') || 
                                  '0');
    
    // Extract line items and match with ingredients
    const items = await this.extractLineItemsWithMatching(entities);
    
    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(entities);

    console.log('Parsed result:', { supplier, invoiceNumber, date, totalAmount, itemsCount: items.length });

    return {
      supplier,
      invoiceNumber,
      date,
      totalAmount,
      confidence,
      items
    };
  }

  /**
   * Parse response from default invoice parser
   */
  private parseDefaultInvoiceResponse(document: any): ProcessedDocument {
    // Similar parsing logic but for standard invoices
    const entities = document.entities || [];
    
    const supplier = this.findEntity(entities, 'supplier_name') || 'Unknown Supplier';
    const invoiceNumber = this.findEntity(entities, 'invoice_number') || '';
    const date = this.findEntity(entities, 'invoice_date') || new Date().toISOString().split('T')[0];
    const totalAmount = parseFloat(this.findEntity(entities, 'total_amount') || '0');
    
    const items = this.extractLineItems(entities);
    const confidence = this.calculateOverallConfidence(entities);

    return {
      supplier,
      invoiceNumber,
      date,
      totalAmount,
      confidence,
      items
    };
  }

  /**
   * Find entity by type
   */
  private findEntity(entities: any[], type: string): string | null {
    const entity = entities.find(e => e.type === type);
    return entity?.mentionText || null;
  }

  /**
   * Extract line items from entities and match with ingredients
   */
  private async extractLineItemsWithMatching(entities: any[]): Promise<Array<{
    name: string;
    quantity: number;
    unit: string;
    price: number;
    total: number;
    supplierCode?: string;
    confidence: number;
    ingredientId?: number;
    ingredientName?: string;
  }>> {
    const lineItems: any[] = [];
    
    // Group entities by line item
    const lineItemGroups = this.groupEntitiesByLineItem(entities);
    
    for (const group of lineItemGroups) {
      const name = this.findEntity(group, 'item_name') || '';
      const quantity = parseFloat(this.findEntity(group, 'quantity') || '0');
      const unit = this.findEntity(group, 'unit') || '';
      const price = parseFloat(this.findEntity(group, 'unit_price') || '0');
      const total = parseFloat(this.findEntity(group, 'line_total') || '0');
      const supplierCode = this.findEntity(group, 'supplier_code');
      const confidence = this.calculateEntityConfidence(group);

      if (name && quantity > 0) {
        // Try to match with ingredients using supplier codes
        const matchedIngredient = await this.matchIngredientBySupplierCode(supplierCode || undefined);
        
        lineItems.push({
          name: matchedIngredient?.name || name,
          quantity,
          unit: matchedIngredient?.unit || unit,
          price,
          total,
          supplierCode,
          confidence,
          ingredientId: matchedIngredient?.id,
          ingredientName: matchedIngredient?.name
        });
      }
    }

    return lineItems;
  }

  /**
   * Extract line items from entities (legacy method)
   */
  private extractLineItems(entities: any[]): Array<{
    name: string;
    quantity: number;
    unit: string;
    price: number;
    total: number;
    supplierCode?: string;
    confidence: number;
  }> {
    const lineItems: any[] = [];
    
    // Group entities by line item
    const lineItemGroups = this.groupEntitiesByLineItem(entities);
    
    lineItemGroups.forEach(group => {
      const name = this.findEntity(group, 'item_name') || '';
      const quantity = parseFloat(this.findEntity(group, 'quantity') || '0');
      const unit = this.findEntity(group, 'unit') || '';
      const price = parseFloat(this.findEntity(group, 'unit_price') || '0');
      const total = parseFloat(this.findEntity(group, 'line_total') || '0');
      const supplierCode = this.findEntity(group, 'supplier_code');
      const confidence = this.calculateEntityConfidence(group);

      if (name && quantity > 0) {
        lineItems.push({
          name,
          quantity,
          unit,
          price,
          total,
          supplierCode,
          confidence
        });
      }
    });

    return lineItems;
  }

  /**
   * Match ingredient by supplier code
   */
  private async matchIngredientBySupplierCode(supplierCode?: string): Promise<{
    id: number;
    name: string;
    unit: string;
  } | null> {
    if (!supplierCode) return null;

    try {
      // Import supabase dynamically to avoid client-side issues
      const { supabase } = await import('@/lib/supabase');
      
      const { data, error } = await supabase
        .from('ingredient_supplier_codes')
        .select(`
          ingredient_id,
          ingredients!inner(id, name, unit)
        `)
        .eq('product_code', supplierCode)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        console.log(`No ingredient found for supplier code: ${supplierCode}`);
        return null;
      }

      return {
        id: data.ingredients[0].id,
        name: data.ingredients[0].name,
        unit: data.ingredients[0].unit
      };
    } catch (error) {
      console.error('Error matching ingredient by supplier code:', error);
      return null;
    }
  }

  /**
   * Group entities by line item
   */
  private groupEntitiesByLineItem(entities: any[]): any[][] {
    // This is a simplified implementation
    // In reality, you'd need to group entities based on their position or line number
    const groups: any[][] = [];
    let currentGroup: any[] = [];
    
    entities.forEach(entity => {
      if (entity.type === 'item_name' && currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      currentGroup.push(entity);
    });
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  }

  /**
   * Calculate confidence for a group of entities
   */
  private calculateEntityConfidence(entities: any[]): number {
    if (entities.length === 0) return 0;
    
    const totalConfidence = entities.reduce((sum, entity) => {
      return sum + (entity.confidence || 0);
    }, 0);
    
    return totalConfidence / entities.length;
  }

  /**
   * Calculate overall confidence for the document
   */
  private calculateOverallConfidence(entities: any[]): number {
    if (entities.length === 0) return 0;
    
    const totalConfidence = entities.reduce((sum, entity) => {
      return sum + (entity.confidence || 0);
    }, 0);
    
    return totalConfidence / entities.length;
  }
}

// Export singleton instance
export const documentAIService = new DocumentAIService();
