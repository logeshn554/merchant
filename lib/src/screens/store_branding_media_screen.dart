import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';

class StoreBrandingMediaScreen extends ConsumerStatefulWidget {
  final String outletId;
  final String outletName;

  const StoreBrandingMediaScreen({
    super.key,
    required this.outletId,
    required this.outletName,
  });

  @override
  ConsumerState<StoreBrandingMediaScreen> createState() => _StoreBrandingMediaScreenState();
}

class _StoreBrandingMediaScreenState extends ConsumerState<StoreBrandingMediaScreen> {
  final _logoUrlCtrl = TextEditingController(text: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200');
  final _coverUrlCtrl = TextEditingController(text: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800');

  bool _isSaving = false;
  String? _errorMessage;

  @override
  void dispose() {
    _logoUrlCtrl.dispose();
    _coverUrlCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });

    try {
      final client = ref.read(apiClientProvider);
      await client.updateOutletStatus(
        widget.outletId,
        null,
        logoUrl: _logoUrlCtrl.text.trim(),
        coverPhotoUrl: _coverUrlCtrl.text.trim(),
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Store logo and cover photo saved successfully!'),
            backgroundColor: AllGoColors.success,
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isSaving = false;
        });
      }
    }
  }

  void _choosePresetLogo(String url) {
    setState(() => _logoUrlCtrl.text = url);
  }

  void _choosePresetCover(String url) {
    setState(() => _coverUrlCtrl.text = url);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AllGoColors.background,
      appBar: AllGoAppBar(title: 'Store Logo & Cover Photo'),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (_errorMessage != null)
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Text('Error: $_errorMessage', style: const TextStyle(color: Colors.red)),
              ),

            // Live Storefront Banner Preview
            Text('Storefront Preview', style: AllGoTypography.heading3),
            const SizedBox(height: 8),
            Container(
              height: 160,
              decoration: BoxDecoration(
                color: Colors.grey.shade200,
                borderRadius: BorderRadius.circular(16),
                image: DecorationImage(
                  image: NetworkImage(_coverUrlCtrl.text),
                  fit: BoxFit.cover,
                  onError: (_, __) {},
                ),
              ),
              child: Stack(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      gradient: LinearGradient(
                        colors: [Colors.black.withOpacity(0.6), Colors.transparent],
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 16,
                    left: 16,
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 28,
                          backgroundColor: Colors.white,
                          backgroundImage: NetworkImage(_logoUrlCtrl.text),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.outletName,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                            const Text('Verified Merchant Outlet', style: TextStyle(color: Colors.white70, fontSize: 12)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Logo URL Input & Presets
            Text('Store Logo (Square 1:1)', style: AllGoTypography.bodyLarge.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text('Used in store icons, cart line items, and notifications', style: AllGoTypography.caption),
            const SizedBox(height: 8),
            AllGoTextField(
              label: 'Logo Image URL',
              controller: _logoUrlCtrl,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                ActionChip(
                  avatar: const Icon(Icons.restaurant, size: 14),
                  label: const Text('Restaurant Logo'),
                  onPressed: () => _choosePresetLogo('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200'),
                ),
                ActionChip(
                  avatar: const Icon(Icons.shopping_basket, size: 14),
                  label: const Text('Grocery Store Logo'),
                  onPressed: () => _choosePresetLogo('https://images.unsplash.com/photo-1542838132-92c53300491e?w=200'),
                ),
                ActionChip(
                  avatar: const Icon(Icons.local_cafe, size: 14),
                  label: const Text('Bakery / Cafe'),
                  onPressed: () => _choosePresetLogo('https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200'),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Cover Photo Input & Presets
            Text('Cover Photo Banner (Wide 16:9)', style: AllGoTypography.bodyLarge.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text('Featured at top of store catalog page for customer browsing', style: AllGoTypography.caption),
            const SizedBox(height: 8),
            AllGoTextField(
              label: 'Cover Banner URL',
              controller: _coverUrlCtrl,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                ActionChip(
                  avatar: const Icon(Icons.photo, size: 14),
                  label: const Text('Dining Ambience'),
                  onPressed: () => _choosePresetCover('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'),
                ),
                ActionChip(
                  avatar: const Icon(Icons.store, size: 14),
                  label: const Text('Fresh Supermarket'),
                  onPressed: () => _choosePresetCover('https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800'),
                ),
                ActionChip(
                  avatar: const Icon(Icons.lunch_dining, size: 14),
                  label: const Text('Fast Food Spread'),
                  onPressed: () => _choosePresetCover('https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800'),
                ),
              ],
            ),
            const SizedBox(height: 32),

            AllGoButton(
              label: 'Save Store Media & Banner',
              isLoading: _isSaving,
              icon: Icons.check,
              onPressed: _handleSave,
            ),
          ],
        ),
      ),
    );
  }
}
