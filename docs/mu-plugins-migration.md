Confirmed. No script/report file remains on the migration branch.

I attempted to start with guardrail scripts, then removed that direction when you clarified that the priority is **code migration**, not checking scripts. The current branch is effectively ready to continue with actual module migration work only.

## Current verified state

The repo is at this staged migration point:

```text
Completed / production-aligned:
- dtb-platform
- dtb-order-platform
- dtb-repair-service

Still transitional:
- dtb-media
- dtb-schematics
- dtb-integrations
- dtb-marketing
- dtb-commerce
- dtb-catalog-platform
```

The remaining issue is still the same architectural pattern: several internal module files continue to delegate into `Legacy/`. For example, `dtb-media/Application/SyncRemoteImage.php` currently loads `dtb-media/Legacy/dtb-image-sync.php`, so `dtb-media` is not yet truly migrated.  The same transitional pattern exists in `dtb-schematics/Application/ResolveSchematicParts.php`, which loads a legacy product-mapping file.  `dtb-integrations/Veeqo/VeeqoClient.php` also delegates to `dtb-integrations/Legacy/dtb-veeqo.php`. 

## Correct next migration sequence

Proceed in this order:

```text
1. dtb-media
2. dtb-schematics
3. dtb-integrations/WooCommerce
4. dtb-integrations/Veeqo
5. dtb-marketing
6. dtb-commerce + dtb-catalog-platform cleanup
```

## Required implementation standard

For each module, the next migration must do this:

```text
Legacy/<old-file>.php
  -> extract real implementation into mapped module-layer files
  -> update bootstrap to load only real module-layer files
  -> convert old root shim to no-op or remove after verification
  -> leave no production file requiring Legacy/
```

Do **not** solve this by adding scripts, wrappers, or reports.

The immediate first target should be:

```text
wp/wp-content/mu-plugins/dtb-media/
```

because `dtb-image-sync.php` is a contained operational module with a clear legacy owner and a defined target structure. The current legacy implementation includes real REST routes, permission callbacks, image sync workflow, image linking, reset/purge/fix-renamed actions, helper functions, admin page rendering, AJAX handler, and ops-dashboard status helpers. 

## Implementation target for `dtb-media`

Migrate `dtb-media/Legacy/dtb-image-sync.php` into:

```text
dtb-media/
├─ Admin/
│  ├─ ImageSyncAdminPage.php
│  └─ MediaDiagnosticsPage.php
├─ Application/
│  ├─ LinkImagesToProducts.php
│  ├─ PurgeUnlinkedImages.php
│  ├─ RegisterProductImages.php
│  ├─ ReleaseImageSyncLock.php
│  ├─ ResetImageSync.php
│  └─ SyncRemoteImage.php
├─ Infrastructure/
│  ├─ ImageSyncRepository.php
│  ├─ MediaAttachmentRepository.php
│  └─ RemoteImageFetcher.php
├─ Rest/
│  ├─ ImageSyncController.php
│  ├─ ImageSyncProgressController.php
│  └─ ImageSyncStatusController.php
├─ Services/
│  ├─ ImageNormalizer.php
│  ├─ ImageSyncService.php
│  ├─ ImageUrlResolver.php
│  └─ ProductImageLinker.php
└─ Validation/
   ├─ ImageMimeValidator.php
   ├─ ImagePathValidator.php
   └─ RemoteImageValidator.php
```

The file `dtb-media/bootstrap.php` should then load only those internal files, and no file under `dtb-media/` should require `dtb-media/Legacy/dtb-image-sync.php`.

