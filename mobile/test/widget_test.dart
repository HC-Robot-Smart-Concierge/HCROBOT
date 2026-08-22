import 'package:flutter_test/flutter_test.dart';
import 'package:hc_robot_mobile/main.dart';
import 'package:hc_robot_mobile/presentation/screens/auth/staff_login_screen.dart';

void main() {
  testWidgets('StaffLoginScreen renders correctly', (WidgetTester tester) async {
    await tester.pumpWidget(const HCRobotApp());

    expect(find.text('Staff ID'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.text('Department'), findsOneWidget);
    expect(find.byType(StaffLoginScreen), findsOneWidget);
  });
}
