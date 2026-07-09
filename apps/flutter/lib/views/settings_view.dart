import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';
import 'package:ota_update/ota_update.dart';

class SettingsView extends StatefulWidget {
  final String themeKey;
  final Function(String) onChangeTheme;
  final String currentVersion = '2.3.0';

  const SettingsView({
    super.key,
    required this.themeKey,
    required this.onChangeTheme,
  });

  @override
  State<SettingsView> createState() => _SettingsViewState();
}

class _SettingsViewState extends State<SettingsView> {
  bool _checkingForUpdates = false;

  // Comparison helper to check if the latest release version is newer than the current version
  bool _isNewerVersion(String current, String latest) {
    try {
      final cleanCurrent = current.startsWith('v') ? current.substring(1) : current;
      final cleanLatest = latest.startsWith('v') ? latest.substring(1) : latest;

      final currentParts = cleanCurrent.split('+')[0].split('.').map(int.parse).toList();
      final latestParts = cleanLatest.split('+')[0].split('.').map(int.parse).toList();

      for (int i = 0; i < 3; i++) {
        final c = currentParts.length > i ? currentParts[i] : 0;
        final l = latestParts.length > i ? latestParts[i] : 0;
        if (l > c) return true;
        if (l < c) return false;
      }
    } catch (e) {
      print('Error parsing version: $e');
    }
    return false;
  }

  Future<void> _checkForUpdates({bool silent = false}) async {
    if (_checkingForUpdates) return;

    setState(() {
      _checkingForUpdates = true;
    });

    try {
      // Fetch latest release from GitHub API
      final response = await http.get(
        Uri.parse('https://api.github.com/repos/thorfin09/zenith/releases/latest'),
        headers: {'Accept': 'application/vnd.github.v3+json'},
      );

      if (!mounted) return;

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final latestTag = data['tag_name'] as String;
        final releaseName = data['name'] ?? latestTag;
        final htmlUrl = data['html_url'] as String;
        final notes = data['body'] ?? 'No release notes provided.';

        if (_isNewerVersion(widget.currentVersion, latestTag)) {
          // Find the APK file asset if available
          String? apkUrl;
          final assets = data['assets'] as List?;
          if (assets != null) {
            for (var asset in assets) {
              final name = asset['name'] as String;
              if (name.endsWith('.apk')) {
                apkUrl = asset['browser_download_url'] as String;
                break;
              }
            }
          }

          final downloadUrl = apkUrl ?? htmlUrl;
          _showUpdateDialog(context, latestTag, releaseName, downloadUrl, notes);
        } else {
          if (!silent) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('You are on the latest version!'),
                backgroundColor: Colors.green,
              ),
            );
          }
        }
      } else if (response.statusCode == 404) {
        if (!silent) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('No updates available (No releases published on GitHub yet).'),
              backgroundColor: Colors.blueAccent,
            ),
          );
        }
      } else {
        if (!silent) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to check for updates. Status code: ${response.statusCode}'),
              backgroundColor: Colors.redAccent,
            ),
          );
        }
      }
    } catch (e) {
      if (!silent) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Network error checking for updates: $e'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _checkingForUpdates = false;
        });
      }
    }
  }

  void _showUpdateDialog(
    BuildContext context,
    String tag,
    String releaseName,
    String downloadUrl,
    String notes,
  ) {
    showDialog(
      context: context,
      builder: (ctx) {
        final theme = Theme.of(ctx);
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              Icon(Icons.system_update_alt, color: theme.colorScheme.primary),
              const SizedBox(width: 10),
              const Text('Update Available!'),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'A new version ($tag) is ready.',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                const SizedBox(height: 8),
                Text('Release: $releaseName'),
                const SizedBox(height: 12),
                const Divider(),
                const SizedBox(height: 8),
                const Text(
                  'What\'s New:',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  notes,
                  style: TextStyle(fontSize: 13, color: theme.colorScheme.onSurface.withOpacity(0.8)),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(
                'Later',
                style: TextStyle(color: theme.colorScheme.onSurface.withOpacity(0.6)),
              ),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: () {
                Navigator.pop(ctx);
                _downloadAndInstallUpdate(downloadUrl);
              },
              child: const Text('Update Now'),
            ),
          ],
        );
      },
    );
  }

  void _downloadAndInstallUpdate(String downloadUrl) {
    double progress = 0.0;
    String statusText = 'Starting download...';
    late StateSetter dialogSetState;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (context, setState) {
            dialogSetState = setState;
            final theme = Theme.of(context);
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: Row(
                children: [
                  SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      value: progress > 0 ? progress / 100 : null,
                      strokeWidth: 3,
                      color: theme.colorScheme.primary,
                    ),
                  ),
                  const SizedBox(width: 16),
                  const Text('Downloading Update'),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    statusText,
                    style: const TextStyle(fontSize: 14),
                  ),
                  const SizedBox(height: 12),
                  LinearProgressIndicator(
                    value: progress > 0 ? progress / 100 : null,
                    backgroundColor: theme.colorScheme.primary.withOpacity(0.1),
                    color: theme.colorScheme.primary,
                  ),
                  const SizedBox(height: 8),
                  if (progress > 0)
                    Align(
                      alignment: Alignment.centerRight,
                      child: Text(
                        '${progress.toInt()}%',
                        style: TextStyle(
                          fontSize: 12,
                          color: theme.colorScheme.onSurface.withOpacity(0.6),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                ],
              ),
            );
          },
        );
      },
    );

    try {
      OtaUpdate()
          .execute(
        downloadUrl,
        destinationFilename: 'zenith-update.apk',
      )
          .listen(
        (OtaEvent event) {
          if (!mounted) return;
          
          dialogSetState(() {
            switch (event.status) {
              case OtaStatus.DOWNLOADING:
                progress = double.tryParse(event.value ?? '0') ?? 0.0;
                statusText = 'Downloading update files...';
                break;
              case OtaStatus.INSTALLING:
                statusText = 'Opening installer...';
                Navigator.of(context, rootNavigator: true).pop();
                break;
              case OtaStatus.PERMISSION_NOT_GRANTED_ERROR:
                Navigator.of(context, rootNavigator: true).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Permission denied to install package.'),
                    backgroundColor: Colors.redAccent,
                  ),
                );
                break;
              default:
                Navigator.of(context, rootNavigator: true).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Update failed: ${event.status} (${event.value})'),
                    backgroundColor: Colors.redAccent,
                  ),
                );
                break;
            }
          });
        },
        onError: (e) {
          if (mounted) {
            Navigator.of(context, rootNavigator: true).pop();
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Download error: $e'),
                backgroundColor: Colors.redAccent,
              ),
            );
          }
        },
      );
    } catch (e) {
      if (mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to initialize OTA update: $e'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  void _launchCoffeeUrl() async {
    final uri = Uri.parse('https://ko-fi.com/thorfin09');
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open link: $e')),
        );
      }
    }
  }

  Widget _buildThemeTile({
    required String themeKey,
    required String title,
    required Color primary,
    required Color background,
    required Color surface,
    required bool isDark,
  }) {
    final isSelected = widget.themeKey == themeKey;
    final theme = Theme.of(context);

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      elevation: isSelected ? 2 : 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isSelected ? theme.colorScheme.primary : theme.colorScheme.onSurface.withOpacity(0.08),
          width: isSelected ? 2.0 : 1.0,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => widget.onChangeTheme(themeKey),
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: Row(
            children: [
              // Theme color previews
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: background,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.grey.withOpacity(0.2)),
                ),
                child: Center(
                  child: Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: surface,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isDark ? 'Dark Mode' : 'Light Mode',
                      style: TextStyle(
                        fontSize: 12,
                        color: theme.colorScheme.onSurface.withOpacity(0.5),
                      ),
                    ),
                  ],
                ),
              ),
              if (isSelected)
                Icon(Icons.check_circle, color: theme.colorScheme.primary, size: 24)
              else
                Icon(Icons.circle_outlined, color: theme.colorScheme.onSurface.withOpacity(0.2), size: 24),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Settings',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Section: Themes
          Row(
            children: [
              Icon(Icons.palette_outlined, color: theme.colorScheme.primary, size: 20),
              const SizedBox(width: 8),
              Text(
                'Personalize Theme',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                  color: theme.colorScheme.primary,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          
          _buildThemeTile(
            themeKey: 'light',
            title: 'Light Indigo',
            primary: const Color(0xFF6366F1),
            background: const Color(0xFFF9FAFB),
            surface: Colors.white,
            isDark: false,
          ),
          _buildThemeTile(
            themeKey: 'dark_blue',
            title: 'Dark Slate (Original)',
            primary: const Color(0xFF6366F1),
            background: const Color(0xFF0F172A),
            surface: const Color(0xFF1E293B),
            isDark: true,
          ),
          _buildThemeTile(
            themeKey: 'midnight',
            title: 'Midnight Black (AMOLED)',
            primary: const Color(0xFFEF4444),
            background: const Color(0xFF000000),
            surface: const Color(0xFF000000),
            isDark: true,
          ),
          _buildThemeTile(
            themeKey: 'amoled_grey',
            title: 'Grey Black (AMOLED)',
            primary: const Color(0xFF9CA3AF),
            background: const Color(0xFF000000),
            surface: const Color(0xFF000000),
            isDark: true,
          ),
          _buildThemeTile(
            themeKey: 'amoled_blue',
            title: 'Blue Black (AMOLED)',
            primary: const Color(0xFF2979FF),
            background: const Color(0xFF000000),
            surface: const Color(0xFF000000),
            isDark: true,
          ),
          _buildThemeTile(
            themeKey: 'forest',
            title: 'Forest Emerald',
            primary: const Color(0xFF10B981),
            background: const Color(0xFF022C22),
            surface: const Color(0xFF064E3B),
            isDark: true,
          ),
          _buildThemeTile(
            themeKey: 'sunset',
            title: 'Sunset Amber',
            primary: const Color(0xFFF59E0B),
            background: const Color(0xFF171717),
            surface: const Color(0xFF262626),
            isDark: true,
          ),

          const SizedBox(height: 24),
          const Divider(),
          const SizedBox(height: 16),

          // Section: Updates
          Row(
            children: [
              Icon(Icons.system_update_alt, color: theme.colorScheme.primary, size: 20),
              const SizedBox(width: 8),
              Text(
                'Updates & Info',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                  color: theme.colorScheme.primary,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: theme.colorScheme.onSurface.withOpacity(0.08)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'App Version',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'v${widget.currentVersion}',
                            style: TextStyle(
                              fontSize: 13,
                              color: theme.colorScheme.onSurface.withOpacity(0.6),
                            ),
                          ),
                        ],
                      ),
                      _checkingForUpdates
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                minimumSize: Size.zero,
                              ),
                              onPressed: () => _checkForUpdates(),
                              icon: const Icon(Icons.refresh, size: 16),
                              label: const Text('Check Now'),
                            ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Divider(),
                  const SizedBox(height: 12),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.favorite, color: Colors.redAccent),
                    title: const Text(
                      'Support on Ko-fi',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    subtitle: Text(
                      'Support the developer',
                      style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurface.withOpacity(0.6)),
                    ),
                    trailing: const Icon(Icons.open_in_new, size: 18),
                    onTap: _launchCoffeeUrl,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
