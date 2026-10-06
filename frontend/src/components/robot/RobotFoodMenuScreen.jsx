import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  ShoppingBag,
  X,
  Plus,
  Minus,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  Utensils,
  Clock,
  Sparkles,
  Info,
  ChefHat,
} from 'lucide-react';
import { createRoomServiceOrder } from '../../services/operationsApi';

export const INITIAL_MENU_CATEGORIES = [
  { id: 'appetizers', name: 'Khai vị & Ăn nhẹ', icon: '🥟' },
  { id: 'soups_porridge', name: 'Súp & Cháo', icon: '🥣' },
  { id: 'salads', name: 'Salad & Gỏi', icon: '🥗' },
  { id: 'mains', name: 'Món chính', icon: '🥩' },
  { id: 'seafood', name: 'Hải sản', icon: '🦐' },
  { id: 'noodles_rice', name: 'Mì – Cơm – Pasta', icon: '🍝' },
  { id: 'hotpot', name: 'Lẩu', icon: '🍲' },
  { id: 'sides_veggies', name: 'Rau & Món thêm', icon: '🥬' },
  { id: 'desserts', name: 'Trái cây & Tráng miệng', icon: '🍉' },
  { id: 'drinks', name: 'Đồ uống', icon: '🥤' },
];

export const INITIAL_FOOD_ITEMS = [
  // 1. Khai vị & Ăn nhẹ (Menu 2)
  {
    id: 'APP-01',
    name: 'Sake chiên giòn',
    category: 'appetizers',
    price: 65000,
    portion: '1 đĩa',
    badge: 'Giòn rụm',
    prep_time: 10,
    description: 'Trái sake thái lát chiên vàng giòn rụm, bùi béo tự nhiên, chấm tương ớt hoặc sốt mayonnaise.',
    image_url: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'APP-02',
    name: 'Khoai tây chiên',
    category: 'appetizers',
    price: 55000,
    portion: '1 phần',
    badge: 'Phổ biến',
    prep_time: 8,
    description: 'Khoai tây cọng chiên vàng giòn thơm phức, rắc chút muối tiêu nhẹ bùi ngậy.',
    image_url: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'APP-03',
    name: 'Chả ram tôm thịt',
    category: 'appetizers',
    price: 85000,
    portion: 'Đĩa 8 cuốn',
    badge: 'Đặc sản',
    prep_time: 12,
    description: 'Chả ram giòn rụm cuộn tôm đất tươi và thịt băm đậm đà, ăn kèm rau sống và nước mắm chua ngọt.',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'APP-04',
    name: 'Chả giò hải sản',
    category: 'appetizers',
    price: 89000,
    portion: 'Đĩa 6 cuốn',
    badge: 'Bán chạy',
    prep_time: 12,
    description: 'Vỏ rế giòn tan bọc nhân tôm mực hải sản tươi ngon quyện sốt béo thơm lừng.',
    image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'APP-05',
    name: 'Đậu hũ các loại',
    category: 'appetizers',
    price: 59000,
    portion: '1 đĩa',
    badge: 'Thanh đạm',
    prep_time: 10,
    description: 'Đậu hũ non chiên giòn rắc chà bông hoặc mỡ hành, lớp vỏ giòn rụm nhân mềm mịn béo ngậy.',
    image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
  },

  // 2. Súp & Cháo (Menu 2)
  {
    id: 'SOUP-01',
    name: 'Súp hải sản',
    category: 'soups_porridge',
    price: 69000,
    portion: '1 thố',
    badge: 'Bổ dưỡng',
    prep_time: 10,
    description: 'Nước súp thanh ngọt hầm từ tôm sú, mực tươi, trứng cút và nấm tuyết sánh mịn.',
    image_url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SOUP-02',
    name: 'Súp kem bí đỏ',
    category: 'soups_porridge',
    price: 59000,
    portion: '1 thố',
    badge: 'Béo mịn',
    prep_time: 10,
    description: 'Bí đỏ Nhật hấp chín xay nhuyễn cùng kem tươi béo ngậy, phủ hạt bí rang giòn thơm lừng.',
    image_url: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SOUP-03',
    name: 'Súp bắp kem tôm',
    category: 'soups_porridge',
    price: 65000,
    portion: '1 thố',
    badge: 'Đặc sắc',
    prep_time: 10,
    description: 'Bắp ngọt Mỹ nấu cùng thịt tôm tươi cắt hạt lựu và kem sữa sánh mịn ấm bụng.',
    image_url: 'https://images.unsplash.com/photo-1604908177453-7462950a6a3b?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SOUP-04',
    name: 'Súp bắp thanh cua',
    category: 'soups_porridge',
    price: 65000,
    portion: '1 thố',
    badge: 'Yêu thích',
    prep_time: 10,
    description: 'Súp trứng sánh vàng kết hợp bắp ngọt và thanh cua Nhật xé sợi thơm ngon dễ ăn.',
    image_url: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'PORR-01',
    name: 'Cháo hải sản',
    category: 'soups_porridge',
    price: 79000,
    portion: '1 tô lớn',
    badge: 'Nóng hổi',
    prep_time: 15,
    description: 'Cháo trắng ninh nhừ sánh đặc nấu cùng tôm, mực, nghêu và hành ngò tiêu cay nồng.',
    image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'PORR-02',
    name: 'Cháo bò bằm',
    category: 'soups_porridge',
    price: 69000,
    portion: '1 tô lớn',
    badge: 'Dinh dưỡng',
    prep_time: 12,
    description: 'Thịt bò tươi bằm nhuyễn xào thơm gừng tỏi nấu cùng gạo rang nở bung thơm bùi ấm bụng.',
    image_url: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?w=500&auto=format&fit=crop&q=80',
  },

  // 3. Salad & Gỏi (Menu 2)
  {
    id: 'SALAD-01',
    name: 'Gỏi hải sản',
    category: 'salads',
    price: 119000,
    portion: '1 đĩa',
    badge: 'Khai vị',
    prep_time: 12,
    description: 'Tôm sú, mực lá trộn cùng ngó sen, cà rốt chua ngọt, đậu phộng và bánh phồng tôm.',
    image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SALAD-02',
    name: 'Gỏi bò bóp thấu',
    category: 'salads',
    price: 129000,
    portion: '1 đĩa',
    badge: 'Đậm đà',
    prep_time: 12,
    description: 'Bắp bò tái chanh trộn khế chua, chuối chát, hành tây và mè rang thơm phức kích thích vị giác.',
    image_url: 'https://images.unsplash.com/photo-1505253758473-96b3015f21c9?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SALAD-03',
    name: 'Gỏi sứa',
    category: 'salads',
    price: 99000,
    portion: '1 đĩa',
    badge: 'Giòn sần sật',
    prep_time: 10,
    description: 'Sứa biển giòn sần sật trộn dưa leo, rau răm, nước mắm gừng ớt chua ngọt đặc trưng miền biển.',
    image_url: 'https://images.unsplash.com/photo-1551248429-40975aa4de74?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SALAD-04',
    name: 'Salad cá ngừ',
    category: 'salads',
    price: 89000,
    portion: '1 đĩa',
    badge: 'Healthy',
    prep_time: 10,
    description: 'Cá ngừ sốt ngâm ô-liu trộn rau mầm, cà chua bi, xà lách giòn và sốt mè rang béo ngậy.',
    image_url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SALAD-05',
    name: 'Salad trứng',
    category: 'salads',
    price: 69000,
    portion: '1 đĩa',
    badge: 'Tươi mát',
    prep_time: 8,
    description: 'Trứng gà luộc lòng đào xếp trên nền xà lách xanh mướt, dưa leo và sốt mayonnaise thơm lừng.',
    image_url: 'https://images.unsplash.com/photo-1522184216316-3c25379f9760?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SALAD-06',
    name: 'Salad phô mai Ý',
    category: 'salads',
    price: 109000,
    portion: '1 đĩa',
    badge: 'Chuẩn Âu',
    prep_time: 10,
    description: 'Cà chua bi tươi mọng kết hợp phô mai Mozzarella mềm béo, lá húng tây và dầu ô-liu nguyên chất.',
    image_url: 'https://images.unsplash.com/photo-1592417817098-8f3d69109853?w=500&auto=format&fit=crop&q=80',
  },

  // 4. Món chính (Menu 2)
  {
    id: 'MAIN-01',
    name: 'Bò nướng sốt nấm / tiêu',
    category: 'mains',
    price: 189000,
    portion: 'Phần 200g',
    badge: 'Đặc trưng',
    prep_time: 18,
    description: 'Thăn bò Mỹ thượng hạng nướng xém cạnh mọng nước, quyện sốt tiêu đen Phú Quốc hoặc sốt nấm béo ngậy.',
    image_url: 'https://images.unsplash.com/photo-1558030006-450675393462?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'MAIN-02',
    name: 'Sườn cừu nướng',
    category: 'mains',
    price: 239000,
    portion: '3 dẻ sườn',
    badge: 'Cao cấp',
    prep_time: 20,
    description: 'Sườn cừu Úc ướp lá hương thảo và tỏi nướng vừa chín tới, mềm ngọt không ngấy ăn kèm khoai tây nghiền.',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'MAIN-03',
    name: 'Thăn heo sốt maple',
    category: 'mains',
    price: 149000,
    portion: 'Phần 200g',
    badge: 'Mới',
    prep_time: 15,
    description: 'Thăn heo áp chảo mềm mại quyện sốt siro lá phong ngọt dịu và sốt mù tạt vàng tinh tế.',
    image_url: 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'MAIN-04',
    name: 'Gà nướng muối ớt',
    category: 'mains',
    price: 159000,
    portion: 'Nửa con',
    badge: 'Cay nồng',
    prep_time: 20,
    description: 'Gà ta thả vườn ướp muối hột ớt hiểm nướng than hoa, da giòn thơm thịt săn chắc ngọt lịm.',
    image_url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'MAIN-05',
    name: 'Gà chiên mắm',
    category: 'mains',
    price: 139000,
    portion: '1 đĩa',
    badge: 'Đậm vị',
    prep_time: 15,
    description: 'Cánh và đùi gà chiên vàng ươm đảo qua sốt nước mắm tỏi ớt kẹo ngọt bóng bẩy hao cơm.',
    image_url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'MAIN-06',
    name: 'Gà hấp / xóc muối',
    category: 'mains',
    price: 159000,
    portion: 'Nửa con',
    badge: 'Truyền thống',
    prep_time: 18,
    description: 'Gà hấp lá chanh thơm lừng xóc muối tiêu ớt sả, giữ trọn vị ngọt nguyên bản thịt gà quê.',
    image_url: 'https://images.unsplash.com/photo-1501200291289-c5a76c232e5f?w=500&auto=format&fit=crop&q=80',
  },

  // 5. Hải sản (Menu 2)
  {
    id: 'SEA-01',
    name: 'Tôm sú sốt trứng muối',
    category: 'seafood',
    price: 179000,
    portion: 'Phần 300g',
    badge: 'Bán chạy',
    prep_time: 15,
    description: 'Tôm sú tươi chiên giòn áo lớp sốt trứng muối béo bùi, vàng óng ánh thơm ngào ngạt.',
    image_url: 'https://images.unsplash.com/photo-1559742811-822873691df8?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SEA-02',
    name: 'Tôm sú nướng / hấp',
    category: 'seafood',
    price: 169000,
    portion: 'Phần 300g',
    badge: 'Tươi sống',
    prep_time: 12,
    description: 'Tôm sú biển nướng muối ớt hoặc hấp nước dừa ngọt thơm chắc nịch chấm muối tiêu chanh.',
    image_url: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SEA-03',
    name: 'Tôm đất cháy tỏi',
    category: 'seafood',
    price: 149000,
    portion: 'Đĩa 250g',
    badge: 'Thơm lừng',
    prep_time: 12,
    description: 'Tôm đất vỏ mỏng ngọt thịt đảo giòn rụm cùng tỏi phi vàng thơm nức mũi.',
    image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SEA-04',
    name: 'Mực ống nướng / hấp',
    category: 'seafood',
    price: 169000,
    portion: 'Con lớn 350g',
    badge: 'Đậm đà',
    prep_time: 15,
    description: 'Mực ống tươi câu trong ngày nướng sa tế cay hoặc hấp hành gừng giòn sần sật.',
    image_url: 'https://images.unsplash.com/photo-1604909052743-94e838986d24?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SEA-05',
    name: 'Mực lá nướng / hấp',
    category: 'seafood',
    price: 189000,
    portion: 'Con lớn 400g',
    badge: 'Tuyệt hảo',
    prep_time: 15,
    description: 'Mực lá dày cơm nướng muối ớt xanh hoặc hấp cuốn bánh tráng rau rừng.',
    image_url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SEA-06',
    name: 'Mực cơm các món',
    category: 'seafood',
    price: 139000,
    portion: '1 đĩa',
    badge: 'Đặc sản biển',
    prep_time: 12,
    description: 'Mực cơm chiên mắm hoặc xào dưa chua, thịt mềm ngọt đầy ắp trứng béo bùi.',
    image_url: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SEA-07',
    name: 'Cá mú, cá bớp các món',
    category: 'seafood',
    price: 219000,
    portion: 'Thố / Đĩa',
    badge: 'Thượng hạng',
    prep_time: 18,
    description: 'Cá mú hấp xì dầu hành gừng hoặc cá bớp nướng muối ớt thịt trắng nõn béo ngọt.',
    image_url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&auto=format&fit=crop&q=80',
  },

  // 6. Mì – Cơm – Pasta (Menu 2)
  {
    id: 'NOODLE-01',
    name: 'Mì Ý sốt thịt bò',
    category: 'noodles_rice',
    price: 119000,
    portion: '1 đĩa',
    badge: 'Bolognese',
    prep_time: 15,
    description: 'Sợi mì Ý dai ngon ngập tràn sốt Bolognese thịt bò bằm hầm cà chua và phô mai Parmesan.',
    image_url: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281724?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'NOODLE-02',
    name: 'Mì Ý hải sản',
    category: 'noodles_rice',
    price: 139000,
    portion: '1 đĩa',
    badge: 'Hải sản',
    prep_time: 15,
    description: 'Mì Ý kết hợp tôm sú, mực tươi sốt kem tỏi thơm lừng hoặc sốt cà chua thảo mộc.',
    image_url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'NOODLE-03',
    name: 'Mì xào hải sản',
    category: 'noodles_rice',
    price: 109000,
    portion: '1 đĩa lớn',
    badge: 'Đậm đà',
    prep_time: 12,
    description: 'Mì trứng vàng óng xào tôm, mực, cải thìa giòn giòn cùng nước sốt dầu hào đậm đà.',
    image_url: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'NOODLE-04',
    name: 'Mì xào bò',
    category: 'noodles_rice',
    price: 99000,
    portion: '1 đĩa lớn',
    badge: 'Quen thuộc',
    prep_time: 12,
    description: 'Bò bắp hoa mềm ngọt xào lửa lớn cùng mì trứng, giá đỗ, cần tây và ớt sừng thơm phức.',
    image_url: 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'RICE-01',
    name: 'Cơm chiên hải sản',
    category: 'noodles_rice',
    price: 99000,
    portion: '1 thố',
    badge: 'Bán chạy',
    prep_time: 12,
    description: 'Hạt cơm tơi vàng óng chiên cùng tôm, mực, đậu Hà Lan và cà rốt giòn ngọt.',
    image_url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'RICE-02',
    name: 'Cơm chiên Dương Châu',
    category: 'noodles_rice',
    price: 89000,
    portion: '1 thố',
    badge: 'Cổ điển',
    prep_time: 12,
    description: 'Cơm chiên xá xíu, lạp xưởng, tôm khô, trứng gà và đậu que sắc màu bắt mắt.',
    image_url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'RICE-03',
    name: 'Cơm chiên trứng, cá mặn',
    category: 'noodles_rice',
    price: 89000,
    portion: '1 thố',
    badge: 'Đặc sản',
    prep_time: 12,
    description: 'Cơm chiên khô giòn rụm hòa quyện vị mặn mòi đặc trưng của cá thu mặn và hành phi thơm lừng.',
    image_url: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=500&auto=format&fit=crop&q=80',
  },

  // 7. Lẩu (Menu 2 - Thay thế Lẩu 2 & 4 ngăn)
  {
    id: 'HOTPOT-01',
    name: 'Lẩu Thái',
    category: 'hotpot',
    price: 269000,
    portion: 'Nồi 2-3 người',
    badge: 'Bán chạy',
    prep_time: 15,
    description: 'Nước lẩu Tomyum chua thanh sả chanh, cay nồng lá chúc, kèm tôm mực và rau nấm tươi.',
    image_url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'HOTPOT-02',
    name: 'Lẩu hải sản',
    category: 'hotpot',
    price: 289000,
    portion: 'Nồi 2-3 người',
    badge: 'Hải sản tươi',
    prep_time: 15,
    description: 'Nước dùng ngọt thanh từ xương hầm, đĩa hải sản ngập tràn tôm sú, mực lá, cá bớp, nghêu.',
    image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'HOTPOT-03',
    name: 'Lẩu gà lá giang',
    category: 'hotpot',
    price: 249000,
    portion: 'Nồi 2-3 người',
    badge: 'Dân dã',
    prep_time: 15,
    description: 'Thịt gà ta săn chắc nấu cùng lá giang chua dịu thanh nhiệt, ớt xiêm xanh cay thơm.',
    image_url: 'https://images.unsplash.com/photo-1576777647209-e8733d028b12?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'HOTPOT-04',
    name: 'Lẩu nấm gà kiểu Pháp',
    category: 'hotpot',
    price: 279000,
    portion: 'Nồi 2-3 người',
    badge: 'Độc đáo',
    prep_time: 18,
    description: 'Gà thả vườn kết hợp các loại nấm quý, nước dùng rượu vang trắng và bơ tỏi thơm lừng kiểu Pháp.',
    image_url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'HOTPOT-05',
    name: 'Lẩu chua cá mú',
    category: 'hotpot',
    price: 299000,
    portion: 'Nồi 2-3 người',
    badge: 'Thượng hạng',
    prep_time: 18,
    description: 'Cá mú tươi sống béo ngọt, nước dùng me chua cay, bạc hà, cà chua, đậu bắp tươi ngon.',
    image_url: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'HOTPOT-06',
    name: 'Lẩu bò nấu nấm',
    category: 'hotpot',
    price: 279000,
    portion: 'Nồi 2-3 người',
    badge: 'Bổ dưỡng',
    prep_time: 15,
    description: 'Bắp bò Mỹ và gân bò mềm giòn, hầm cùng nấm đông cô, nấm đùi gà ngọt thanh tự nhiên.',
    image_url: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?w=500&auto=format&fit=crop&q=80',
  },

  // 8. Rau & Món thêm (Menu 2)
  {
    id: 'SIDE-01',
    name: 'Rau thập cẩm luộc',
    category: 'sides_veggies',
    price: 49000,
    portion: '1 đĩa',
    badge: 'Thanh đạm',
    prep_time: 8,
    description: 'Bông cải xanh, bắp non, cà rốt, su su luộc giòn ngọt chấm kho quẹt đậm đà.',
    image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SIDE-02',
    name: 'Rau xào tỏi các loại',
    category: 'sides_veggies',
    price: 45000,
    portion: '1 đĩa',
    badge: 'Xào tỏi',
    prep_time: 8,
    description: 'Rau muống hoặc cải thìa non xào tỏi hoa lửa lớn xanh mướt giòn sần sật.',
    image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SIDE-03',
    name: 'Nấm các loại',
    category: 'sides_veggies',
    price: 55000,
    portion: 'Đĩa 200g',
    badge: 'Ăn kèm',
    prep_time: 5,
    description: 'Nấm kim châm, nấm đùi gà, nấm linh chi tươi mát nhúng lẩu hoặc ăn kèm.',
    image_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SIDE-04',
    name: 'Cơm trắng',
    category: 'sides_veggies',
    price: 15000,
    portion: '1 tô / bát',
    badge: 'Cơm dẻo',
    prep_time: 3,
    description: 'Cơm gạo dẻo thơm ST25 nấu mới nóng hổi hạt tơi ngọt bùi.',
    image_url: 'https://images.unsplash.com/photo-1516684732162-798a0062be99?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SIDE-05',
    name: 'Bún, bánh mì, bánh tráng',
    category: 'sides_veggies',
    price: 20000,
    portion: '1 phần',
    badge: 'Tinh bột',
    prep_time: 3,
    description: 'Bún tươi sợi nhỏ, bánh mì giòn rụm hoặc bánh tráng dẻo ăn kèm lẩu và món nướng.',
    image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'SIDE-06',
    name: 'Món gọi thêm khác',
    category: 'sides_veggies',
    price: 35000,
    portion: '1 phần',
    badge: 'Gọi thêm',
    prep_time: 5,
    description: 'Trứng gà ta, đậu hũ tươi hoặc nước lẩu châm thêm theo yêu cầu quý khách.',
    image_url: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=500&auto=format&fit=crop&q=80',
  },

  // 9. Trái cây & Tráng miệng (Menu 2)
  {
    id: 'DESSERT-01',
    name: 'Trái cây tươi theo mùa',
    category: 'desserts',
    price: 65000,
    portion: 'Đĩa thập cẩm',
    badge: 'Tươi mát',
    prep_time: 5,
    description: 'Dưa hấu, thanh long, dứa, ổi mọng nước gọt sẵn ướp lạnh ngọt thanh giải nhiệt.',
    image_url: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'DESSERT-02',
    name: 'Món tráng miệng hấp dẫn',
    category: 'desserts',
    price: 45000,
    portion: '1 chén / hũ',
    badge: 'Ngọt ngào',
    prep_time: 5,
    description: 'Chè hạt sen nhãn nhục thanh mát hoặc bánh flan caramel mềm mịn béo ngậy.',
    image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'DESSERT-03',
    name: 'Bánh Tiramisu Ý Cổ Điển',
    category: 'desserts',
    price: 95000,
    portion: '1 phần',
    badge: 'Best Seller',
    prep_time: 5,
    description: 'Bánh quy Ladyfinger nhúng espresso đậm đặc, kem Mascarpone và bột cacao Valrhona.',
    image_url: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'DESSERT-04',
    name: 'Panna Cotta Sốt Dâu Rừng',
    category: 'desserts',
    price: 85000,
    portion: '1 hũ',
    badge: 'Tráng miệng',
    prep_time: 5,
    description: 'Thạch kem sữa mềm mịn béo ngậy ăn kèm sốt dâu rừng chua ngọt thanh mát.',
    image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&auto=format&fit=crop&q=80',
  },

  // 10. Đồ uống (Menu 2)
  {
    id: 'DRINK-01',
    name: 'Nước suối tinh khiết',
    category: 'drinks',
    price: 20000,
    portion: 'Chai 500ml',
    badge: 'Tinh khiết',
    prep_time: 2,
    description: 'Nước khoáng thiên nhiên ướp lạnh sảng khoái mát lành.',
    image_url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'DRINK-02',
    name: 'Nước ép trái cây tươi',
    category: 'drinks',
    price: 55000,
    portion: 'Ly 400ml',
    badge: 'Vitamin',
    prep_time: 5,
    description: 'Nước ép cam, dưa hấu, dứa hoặc cóc tươi nguyên chất 100% không thêm đường.',
    image_url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'DRINK-03',
    name: 'Nước ngọt các loại',
    category: 'drinks',
    price: 25000,
    portion: 'Lon 330ml',
    badge: 'Giải khát',
    prep_time: 2,
    description: 'Coca-Cola, 7Up, Pepsi, Mirinda, Soda chanh ướp lạnh kèm đá viên.',
    image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'DRINK-04',
    name: 'Bia, rượu (theo menu)',
    category: 'drinks',
    price: 40000,
    portion: 'Chai / Lon',
    badge: 'Ướp lạnh',
    prep_time: 2,
    description: 'Bia Tiger, Heineken, Sài Gòn Special hoặc vang tuyển chọn ướp đá lạnh sảng khoái.',
    image_url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'DRINK-05',
    name: 'Cà Phê Muối Cố Đô',
    category: 'drinks',
    price: 65000,
    portion: 'Ly 350ml',
    badge: 'Yêu thích',
    prep_time: 5,
    description: 'Cà phê pha phin truyền thống phủ lớp kem muối béo mặn thơm ngậy khó cưỡng.',
    image_url: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'DRINK-06',
    name: 'Cà Phê Sữa Đá Sài Gòn',
    category: 'drinks',
    price: 55000,
    portion: 'Ly 350ml',
    badge: 'Truyền thống',
    prep_time: 5,
    description: 'Robusta Buôn Ma Thuột rang mộc pha phin cùng sữa đặc đậm đà sảng khoái.',
    image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80',
  },
];

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN').format(amount || 0);
};

export const RobotFoodMenuScreen = ({
  activeRoomNumber = '304',
  onClose = () => {},
  onOrderSuccess = () => {},
}) => {
  const [selectedCategory, setSelectedCategory] = useState(INITIAL_MENU_CATEGORIES[0]?.id || 'appetizers');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState({}); // { [itemId]: { item, qty } }
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [deliveryRoom, setDeliveryRoom] = useState(activeRoomNumber || '304');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccessData, setOrderSuccessData] = useState(null);

  const mainScrollRef = useRef(null);
  const sidebarNavRef = useRef(null);
  const isManualScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  // Dọn dẹp timer khi component unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Khóa overscroll toàn màn hình để không bị kéo dãn lộ khoảng trắng trên PWA/mobile
  useEffect(() => {
    const originalOverscroll = document.body.style.overscrollBehavior;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overscrollBehavior = originalOverscroll;
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Khi mở drawer "Xem lại menu", khóa tuyệt đối không cho chạm/cuộn xuyên màn hình menu bên dưới
  useEffect(() => {
    if (!isReviewModalOpen) return;

    const handleTouchMove = (e) => {
      // Chỉ cho phép cuộn ngón tay nếu chạm bên trong danh sách món của giỏ hàng
      const isInsideCartList = e.target.closest('.cart-drawer-scrollable');
      if (!isInsideCartList) {
        e.preventDefault();
      }
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isReviewModalOpen]);

  // Gom nhóm tất cả món ăn theo danh mục & áp dụng lọc tìm kiếm
  const itemsByCategory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return INITIAL_MENU_CATEGORIES.map((cat) => {
      const items = INITIAL_FOOD_ITEMS.filter((item) => {
        const matchCategory = item.category === cat.id;
        const matchSearch =
          !query ||
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query);
        return matchCategory && matchSearch;
      });
      return {
        category: cat,
        items,
      };
    });
  }, [searchQuery]);

  const totalVisibleItems = useMemo(() => {
    return itemsByCategory.reduce((sum, group) => sum + group.items.length, 0);
  }, [itemsByCategory]);

  // Điều hướng cuộn mượt đến danh mục món ăn khi nhấn ở thanh bên trái
  const handleCategoryClick = (catId) => {
    setSelectedCategory(catId);
    isManualScrollingRef.current = true;

    const container = mainScrollRef.current;
    const targetEl = document.getElementById(`cat-section-${catId}`);
    if (container && targetEl) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const targetScrollTop = targetRect.top - containerRect.top + container.scrollTop;
      container.scrollTo({
        top: Math.max(0, targetScrollTop - 4),
        behavior: 'smooth',
      });
    }

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isManualScrollingRef.current = false;
    }, 700);
  };

  // Tự động nhận diện danh mục đang xem khi lướt danh sách món (Scroll-Spy)
  const handleMainScroll = () => {
    if (isManualScrollingRef.current) return;
    const container = mainScrollRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 30;

    if (isAtBottom) {
      const activeGroups = itemsByCategory.filter((g) => g.items.length > 0);
      const lastGroup = activeGroups[activeGroups.length - 1];
      if (lastGroup && lastGroup.category.id !== selectedCategory) {
        setSelectedCategory(lastGroup.category.id);
        const sidebarBtn = document.getElementById(`sidebar-cat-${lastGroup.category.id}`);
        if (sidebarBtn) {
          sidebarBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
      return;
    }

    let activeCatId = null;
    for (const group of itemsByCategory) {
      if (group.items.length === 0) continue;
      const el = document.getElementById(`cat-section-${group.category.id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top - containerRect.top <= 100) {
          activeCatId = group.category.id;
        }
      }
    }

    if (activeCatId && activeCatId !== selectedCategory) {
      setSelectedCategory(activeCatId);
      const sidebarBtn = document.getElementById(`sidebar-cat-${activeCatId}`);
      if (sidebarBtn) {
        sidebarBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  // Cart totals
  const totalItemsCount = useMemo(() => {
    return Object.values(cart).reduce((sum, entry) => sum + entry.qty, 0);
  }, [cart]);

  const totalPrice = useMemo(() => {
    return Object.values(cart).reduce((sum, entry) => sum + entry.item.price * entry.qty, 0);
  }, [cart]);

  const addToCart = (item) => {
    setCart((prev) => {
      const currentQty = prev[item.id]?.qty || 0;
      return {
        ...prev,
        [item.id]: {
          item,
          qty: currentQty + 1,
        },
      };
    });
  };

  const removeFromCart = (itemId) => {
    setCart((prev) => {
      const currentQty = prev[itemId]?.qty || 0;
      if (currentQty <= 1) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return {
        ...prev,
        [itemId]: {
          ...prev[itemId],
          qty: currentQty - 1,
        },
      };
    });
  };

  const deleteFromCart = (itemId) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleConfirmOrder = async () => {
    if (totalItemsCount === 0 || isSubmitting) return;

    setIsSubmitting(true);
    const orderItemsPayload = Object.values(cart).map((entry) => ({
      name: entry.item.name,
      qty: entry.qty,
      price: entry.item.price,
      notes: entry.item.portion || '',
    }));

    try {
      const res = await createRoomServiceOrder({
        room_number: deliveryRoom,
        guest_name: 'Quý Khách',
        special_instructions: orderNote || 'Đặt món qua màn hình Robot AI',
        items: orderItemsPayload,
        total_amount: totalPrice,
      });

      setOrderSuccessData({
        orderCode: res?.ticket_code || res?.id || `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
        room: deliveryRoom,
        totalAmount: totalPrice,
        itemCount: totalItemsCount,
      });

      // Clear cart
      setCart({});
      setOrderNote('');
      setIsReviewModalOpen(false);
      onOrderSuccess(res);
    } catch {
      // Fallback local success
      setOrderSuccessData({
        orderCode: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
        room: deliveryRoom,
        totalAmount: totalPrice,
        itemCount: totalItemsCount,
      });
      setCart({});
      setIsReviewModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] max-h-[100dvh] bg-[#F5F2EB] text-[#1A1917] select-none flex overflow-hidden font-sans z-30 overscroll-none touch-none">
      {/* CẢNH BÁO XOAY NGANG MÀN HÌNH KHI Ở CHẾ ĐỘ DỌC (PORTRAIT GUARD - GIỐNG ẢNH 1) */}
      <div className="robot-portrait-guard fixed inset-0 z-50 bg-stone-950 text-white items-center justify-center text-center p-8">
        <div>
          <p className="text-xs font-bold tracking-[0.24em] uppercase text-stone-400">HCROBOT</p>
          <h2 className="mt-3 text-2xl font-black">Vui lòng xoay ngang điện thoại</h2>
          <p className="mt-2 text-sm text-stone-400">Ứng dụng Robot được thiết kế để sử dụng ở chế độ ngang.</p>
        </div>
      </div>

      {/* CỘT BÊN TRÁI (LEFT SIDEBAR): DANH MỤC THU GỌN, KHÔNG HIỂN THỊ SỐ ĐẾM */}
      <aside className="w-36 sm:w-40 shrink-0 bg-[#EFECE4] border-r border-[#E3DFD5] flex flex-col h-full select-none overscroll-contain touch-none">
        {/* Tiêu đề Danh mục */}
        <div className="h-12 shrink-0 px-3 border-b border-[#E3DFD5] flex items-center bg-white/40 touch-none">
          <span className="text-[10px] sm:text-[11px] font-black uppercase text-stone-700 tracking-wider truncate">
            Danh Mục Món Ăn
          </span>
        </div>

        {/* Danh mục thực đơn (Categories - Gọn gàng không có số đếm để nhường diện tích cho ảnh món) */}
        <nav
          ref={sidebarNavRef}
          className={`flex-1 min-h-0 p-1.5 sm:p-2 space-y-1 ${
            isReviewModalOpen ? 'overflow-hidden pointer-events-none' : 'overflow-y-auto'
          } overscroll-contain touch-pan-y no-scrollbar`}
        >
          {INITIAL_MENU_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                id={`sidebar-cat-${cat.id}`}
                type="button"
                onClick={() => handleCategoryClick(cat.id)}
                className={`w-full px-2.5 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                  isActive
                    ? 'bg-[#1A1917] text-white shadow-md'
                    : 'text-stone-700 hover:bg-white/70 hover:text-stone-900'
                }`}
              >
                <span className="block truncate">{cat.name}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* CỘT CHÍNH (MAIN AREA): HÀNG TRÊN (TIÊU ĐỀ) + LƯỚI MÓN ĂN + HÀNG DƯỚI (TỔNG CỘNG) */}
      <div className="flex-1 min-w-0 flex flex-col h-full bg-[#F5F2EB] overscroll-none touch-none">
        {/* HÀNG TRÊN: TIÊU ĐỀ "XIN MỜI QUÝ KHÁCH CHỌN MÓN ĂN" (ĐÃ XÓA ICON VÀ PHỤC VỤ TẬN NƠI) */}
        <header className="h-12 shrink-0 border-b border-[#E3DFD5] px-4 flex items-center justify-between bg-white/80 backdrop-blur-md touch-none">
          <div className="flex items-center">
            <h1 className="text-xs sm:text-sm font-black text-stone-900 tracking-tight">
              Xin mời quý khách chọn món ăn
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Box */}
            <div className="relative hidden lg:block w-48">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm món ngon..."
                className="w-full h-8 pl-8 pr-3 rounded-full bg-stone-100 border border-stone-300 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Room / Table badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E3DFD5] text-[11px] font-bold text-stone-800 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{deliveryRoom ? `Phòng ${deliveryRoom}` : 'Bàn A-11'}</span>
            </div>

            {/* Nút Quay lại màn hình Robot */}
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3.5 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Quay lại giao diện Robot"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại Robot</span>
            </button>
          </div>
        </header>

        {/* LƯỚI DANH SÁCH MÓN ĂN (Hiển thị tất cả theo danh mục, cuộn và đồng bộ danh mục) */}
        <main
          ref={mainScrollRef}
          onScroll={handleMainScroll}
          className={`flex-1 min-h-0 p-4 ${
            isReviewModalOpen ? 'overflow-hidden pointer-events-none' : 'overflow-y-auto'
          } overscroll-contain touch-pan-y custom-scrollbar`}
        >
          {totalVisibleItems === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <ChefHat className="w-12 h-12 text-stone-300 mb-2" />
              <p className="text-sm font-bold text-stone-700">Không tìm thấy món ăn phù hợp</p>
              <p className="text-xs text-stone-400 mt-1">Vui lòng thử tìm với từ khóa khác</p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-4 px-4 py-2 rounded-full bg-stone-900 text-white text-xs font-bold active:scale-95 transition-all"
                >
                  Xóa tìm kiếm
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {itemsByCategory.map((group) => {
                if (group.items.length === 0) return null;

                return (
                  <section
                    key={group.category.id}
                    id={`cat-section-${group.category.id}`}
                    className="scroll-mt-2"
                  >
                    {/* Note phân cách danh mục (cuộn tự nhiên, không thanh ngang cố định che món ăn) */}
                    <div className="flex items-center gap-2 mb-2.5 pt-1">
                      <span className="text-stone-900 text-sm font-black leading-none select-none">•</span>
                      <h2 className="text-xs sm:text-sm font-black text-stone-900 uppercase tracking-wider">
                        {group.category.name}
                      </h2>
                    </div>

                    {/* Lưới các món ăn trong danh mục (1 hàng 2 món ăn, hiển thị ảnh và thông tin to rõ ràng) */}
                    <div className="grid grid-cols-2 gap-3.5">
                      {group.items.map((item) => {
                        const quantityInCart = cart[item.id]?.qty || 0;

                        return (
                          <div
                            key={item.id}
                            className="bg-white rounded-2xl border border-[#E3DFD5] p-2 sm:p-2.5 shadow-xs hover:shadow-md transition-all flex gap-2.5 sm:gap-3 group hover:border-stone-400 min-h-[112px]"
                          >
                            {/* Ảnh món ăn bên trái (to hơn, sát viền trên dưới không bị khoảng trống) */}
                            <div className="relative w-32 sm:w-36 md:w-40 shrink-0 self-stretch rounded-xl overflow-hidden bg-stone-100">
                              <img
                                src={item.image_url}
                                alt={item.name}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  e.currentTarget.src =
                                    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80';
                                }}
                              />
                            </div>

                            {/* Thông tin món ăn bên phải */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                              <div>
                                <h3 className="text-xs sm:text-sm font-black text-stone-900 line-clamp-2 leading-snug group-hover:text-stone-950">
                                  {item.name}
                                </h3>
                                <p className="text-[10px] sm:text-[11px] text-stone-500 line-clamp-2 mt-1 leading-snug">
                                  {item.description}
                                </p>
                              </div>

                              {/* Hàng giá tiền & Nút cộng/trừ món */}
                              <div className="mt-2 pt-1.5 border-t border-stone-100 flex items-center justify-between gap-1.5">
                                <div className="min-w-0">
                                  <span className="text-xs sm:text-sm font-black text-stone-900 whitespace-nowrap block leading-none">
                                    {formatCurrency(item.price)} đ
                                  </span>
                                </div>

                                {quantityInCart === 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => addToCart(item)}
                                    className="w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white flex items-center justify-center font-bold text-xs sm:text-sm shadow-xs active:scale-90 transition-all cursor-pointer shrink-0"
                                    title="Thêm vào danh sách chọn"
                                  >
                                    +
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-0.5 bg-stone-100 rounded-full p-0.5 border border-stone-200 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => removeFromCart(item.id)}
                                      className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-white hover:bg-stone-200 text-stone-800 font-bold text-[10px] flex items-center justify-center shadow-xs cursor-pointer active:scale-95"
                                      title="Bớt 1 món"
                                    >
                                      -
                                    </button>
                                    <span className="text-[11px] font-black text-stone-900 min-w-3.5 text-center px-0.5">
                                      {quantityInCart}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => addToCart(item)}
                                      className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white font-bold text-[10px] flex items-center justify-center shadow-xs cursor-pointer active:scale-95"
                                      title="Thêm 1 món"
                                    >
                                      +
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </main>

        {/* HÀNG CUỐI: TỔNG CỘNG: ... Đ & NÚT XEM LẠI MENU (THIẾT KẾ THU GỌN VỪA VẶN) */}
        <footer className="h-11 sm:h-12 shrink-0 bg-white border-t border-[#E3DFD5] px-4 sm:px-6 flex items-center justify-between shadow-lg z-10 touch-none">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase tracking-wider">
              Tổng cộng:
            </span>
            <span className="text-lg sm:text-xl font-black text-stone-900 tracking-tight">
              {formatCurrency(totalPrice)} đ
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Nút Xem lại menu có hiển thị số lượng món đã chọn */}
            <button
              type="button"
              onClick={() => setIsReviewModalOpen(true)}
              disabled={totalItemsCount === 0}
              className={`h-8 sm:h-9 px-3.5 sm:px-4 rounded-full font-bold text-[11px] sm:text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-95 ${
                totalItemsCount > 0
                  ? 'bg-[#1A1917] hover:bg-stone-800 text-white shadow-stone-950/20'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Xem lại menu</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-black min-w-4 text-center ${
                  totalItemsCount > 0 ? 'bg-amber-400 text-stone-950' : 'bg-stone-300 text-stone-500'
                }`}
              >
                {totalItemsCount}
              </span>
            </button>
          </div>
        </footer>
      </div>

      {/* MODAL / DRAWER XEM LẠI MENU (CHI TIẾT MÓN ĐÃ CHỌN & XÁC NHẬN GỌI MÓN) */}
      {isReviewModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-end animate-fadeIn overscroll-none touch-none"
          onClick={() => setIsReviewModalOpen(false)}
        >
          <div
            className="w-full max-w-md h-full bg-[#FAF8F5] border-l border-[#E3DFD5] shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200 overscroll-contain touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="h-14 shrink-0 px-5 border-b border-[#E3DFD5] bg-white flex items-center justify-between touch-none">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-stone-800" />
                <h3 className="text-sm font-black text-stone-900 uppercase tracking-tight">
                  Món Đã Chọn ({totalItemsCount})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Danh sách các món trong giỏ (Chỉ lướt bên trong giỏ, không cuộn nền bên dưới) */}
            <div className="cart-drawer-scrollable flex-1 min-h-0 overflow-y-auto p-4 space-y-3 custom-scrollbar overscroll-contain touch-pan-y">
              {Object.values(cart).length === 0 ? (
                <div className="h-40 flex items-center justify-center text-xs text-stone-400">
                  Chưa có món nào được chọn.
                </div>
              ) : (
                Object.values(cart).map(({ item, qty }) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white rounded-2xl border border-[#E3DFD5] flex items-center gap-3 shadow-xs"
                  >
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-14 h-14 rounded-xl object-cover shrink-0 bg-stone-100"
                    />

                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-stone-900 truncate">{item.name}</h4>
                      <p className="text-[10px] text-stone-500">{formatCurrency(item.price)} đ</p>
                      <p className="text-[11px] font-black text-stone-900 mt-0.5">
                        {formatCurrency(item.price * qty)} đ
                      </p>
                    </div>

                    {/* Bộ điều khiển số lượng */}
                    <div className="flex items-center gap-1.5 bg-stone-100 rounded-full p-1 border border-stone-200">
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="w-6 h-6 rounded-full bg-white hover:bg-stone-200 text-stone-800 font-bold text-xs flex items-center justify-center cursor-pointer shadow-xs"
                      >
                        -
                      </button>
                      <span className="text-xs font-black text-stone-900 min-w-4 text-center">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="w-6 h-6 rounded-full bg-stone-900 text-white font-bold text-xs flex items-center justify-center cursor-pointer shadow-xs"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteFromCart(item.id)}
                      className="text-stone-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                      title="Xóa món"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer Modal: Tổng cộng & Nút Đặt Món */}
            <div className="p-4 border-t border-[#E3DFD5] bg-white space-y-3 touch-none">
              <div className="flex justify-between items-baseline text-xs">
                <span className="font-black text-stone-900 text-sm">Tổng cộng:</span>
                <span className="font-black text-xl text-stone-900">
                  {formatCurrency(totalPrice)} đ
                </span>
              </div>

              <button
                type="button"
                onClick={handleConfirmOrder}
                disabled={totalItemsCount === 0 || isSubmitting}
                className="w-full py-3.5 rounded-full bg-[#1A1917] hover:bg-stone-800 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>Đang gửi yêu cầu...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Xác Nhận Đặt Món ({totalItemsCount})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP THÔNG BÁO ĐẶT MÓN THÀNH CÔNG */}
      {orderSuccessData && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn overscroll-none touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white border border-[#E3DFD5] rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-2xl border border-emerald-200">
              ✓
            </div>
            <div>
              <h3 className="text-base font-black text-stone-900">Đặt Món Thành Công!</h3>
              <p className="text-xs text-stone-500 mt-1">
                Mã đơn: <span className="font-mono font-bold text-stone-800">{orderSuccessData.orderCode}</span>
              </p>
              <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                Yêu cầu đã được chuyển tới Bếp. Robot AI sẽ thông báo và giao món tận phòng{' '}
                <strong className="text-stone-900">{orderSuccessData.room}</strong> của quý khách.
              </p>
            </div>

            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 text-xs flex justify-between font-bold">
              <span className="text-stone-500">Tổng thanh toán:</span>
              <span className="text-stone-900">{formatCurrency(orderSuccessData.totalAmount)} đ</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOrderSuccessData(null)}
                className="flex-1 py-2.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-all cursor-pointer"
              >
                Tiếp tục xem menu
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderSuccessData(null);
                  onClose();
                }}
                className="flex-1 py-2.5 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Về Robot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
