import 'package:flutter/material.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';

class MerchantMenuCatalogTab extends StatelessWidget {
  final List<ProductItem> products;
  final bool isLoading;
  final VoidCallback onRefresh;
  final void Function(ProductItem product, bool inStock) onToggleStock;
  final VoidCallback onAddProduct;

  const MerchantMenuCatalogTab({
    super.key,
    required this.products,
    required this.isLoading,
    required this.onRefresh,
    required this.onToggleStock,
    required this.onAddProduct,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: AllGoButton(
            label: 'Add New Menu Item',
            icon: Icons.add,
            onPressed: onAddProduct,
          ),
        ),
        Expanded(
          child: isLoading
              ? const Center(child: CircularProgressIndicator())
              : products.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.restaurant_menu, size: 48, color: AllGoColors.textTertiary),
                          const SizedBox(height: 12),
                          Text('No items in menu catalog', style: AllGoTypography.subtitle),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: () async => onRefresh(),
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: products.length,
                        itemBuilder: (context, index) {
                          final product = products[index];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 10),
                            child: ListTile(
                              leading: Icon(
                                Icons.circle,
                                size: 16,
                                color: product.isVeg ? Colors.green : Colors.red,
                              ),
                              title: Text(product.name, style: AllGoTypography.bodyMedium.copyWith(fontWeight: FontWeight.bold)),
                              subtitle: Text('₹${product.basePriceInr.toStringAsFixed(0)} • Stock: ${product.stockQuantity}', style: AllGoTypography.caption),
                              trailing: Switch(
                                value: product.isInStock,
                                activeColor: AllGoColors.success,
                                onChanged: (val) => onToggleStock(product, val),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
        ),
      ],
    );
  }
}
