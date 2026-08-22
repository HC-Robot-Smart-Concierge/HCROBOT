import 'package:flutter/material.dart';
import 'core/constants/app_colors.dart';
import 'presentation/screens/auth/staff_login_screen.dart';

void main() {
  runApp(const HCRobotApp());
}

class HCRobotApp extends StatelessWidget {
  const HCRobotApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Hotel Concierge Staff App',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: AppColors.backgroundCanvas,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.primaryDark,
          primary: AppColors.primaryDark,
          secondary: AppColors.accentGold,
        ),
        fontFamily: 'Inter',
      ),
      home: const StaffLoginScreen(),
    );
  }
}
