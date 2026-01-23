-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: workshop_db
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `assist_approvals`
--

DROP TABLE IF EXISTS `assist_approvals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assist_approvals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `phase_key` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `assistant_user_id` int NOT NULL,
  `assist_start` datetime NOT NULL,
  `assist_end` datetime NOT NULL,
  `manager_id` int NOT NULL,
  `requested_by` int NOT NULL,
  `status` enum('pending','approved','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'pending',
  `decision_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `decision_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  KEY `assistant_user_id` (`assistant_user_id`),
  KEY `manager_id` (`manager_id`),
  KEY `requested_by` (`requested_by`),
  CONSTRAINT `assist_approvals_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`),
  CONSTRAINT `assist_approvals_ibfk_2` FOREIGN KEY (`assistant_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `assist_approvals_ibfk_3` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`),
  CONSTRAINT `assist_approvals_ibfk_4` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assist_approvals`
--

LOCK TABLES `assist_approvals` WRITE;
/*!40000 ALTER TABLE `assist_approvals` DISABLE KEYS */;
INSERT INTO `assist_approvals` VALUES (13,622,'machining',170,'2026-01-19 15:10:00','2026-01-19 15:40:00',86,92,'approved',NULL,'2026-01-19 15:41:21','2026-01-19 07:41:00');
/*!40000 ALTER TABLE `assist_approvals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_records`
--

DROP TABLE IF EXISTS `attendance_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `clock_in` datetime NOT NULL,
  `clock_out` datetime DEFAULT NULL,
  `total_minutes` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `standard_hours` int DEFAULT '480' COMMENT '标准工作时长（分钟）',
  `overtime_minutes` int DEFAULT '0' COMMENT '加班时长（分钟）',
  `leave_minutes` int DEFAULT '0' COMMENT '请假时长（分钟）',
  `adjustment_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci COMMENT '调整备注',
  `adjusted_by` int DEFAULT NULL COMMENT '调整人ID',
  `adjusted_at` timestamp NULL DEFAULT NULL COMMENT '调整时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_date` (`user_id`,`clock_in`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_records`
--

LOCK TABLES `attendance_records` WRITE;
/*!40000 ALTER TABLE `attendance_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendance_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `daily_attendance`
--

DROP TABLE IF EXISTS `daily_attendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `daily_attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `date` date NOT NULL,
  `standard_attendance_hours` decimal(5,2) NOT NULL DEFAULT '8.00',
  `overtime_hours` decimal(5,2) NOT NULL DEFAULT '0.00',
  `leave_hours` decimal(5,2) NOT NULL DEFAULT '0.00',
  `actual_hours` decimal(5,2) GENERATED ALWAYS AS (((`standard_attendance_hours` + `overtime_hours`) - `leave_hours`)) STORED,
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `adjusted_by` int DEFAULT NULL,
  `adjusted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `overtime_start_time` varchar(5) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `overtime_end_time` varchar(5) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `leave_start_time` varchar(5) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `leave_end_time` varchar(5) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_confirmed` tinyint(1) NOT NULL DEFAULT '0',
  `confirmed_by` int DEFAULT NULL,
  `confirmed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_date` (`user_id`,`date`)
) ENGINE=InnoDB AUTO_INCREMENT=642 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `daily_attendance`
--

LOCK TABLES `daily_attendance` WRITE;
/*!40000 ALTER TABLE `daily_attendance` DISABLE KEYS */;
INSERT INTO `daily_attendance` (`id`, `user_id`, `date`, `standard_attendance_hours`, `overtime_hours`, `leave_hours`, `note`, `adjusted_by`, `adjusted_at`, `created_at`, `updated_at`, `overtime_start_time`, `overtime_end_time`, `leave_start_time`, `leave_end_time`, `is_confirmed`, `confirmed_by`, `confirmed_at`) VALUES (585,152,'2026-01-16',8.00,2.00,0.00,NULL,133,'2026-01-16 03:46:35','2026-01-16 03:46:35','2026-01-16 03:46:35',NULL,NULL,NULL,NULL,0,NULL,NULL),(586,142,'2026-01-16',7.58,2.00,0.00,NULL,133,'2026-01-16 05:39:38','2026-01-16 05:39:38','2026-01-16 05:39:38',NULL,NULL,NULL,NULL,0,NULL,NULL),(587,170,'2026-01-16',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:25','2026-01-19 02:30:25','2026-01-19 02:32:17',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:32:17'),(588,171,'2026-01-16',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:25','2026-01-19 02:30:25','2026-01-19 02:32:20',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:32:20'),(589,172,'2026-01-16',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:25','2026-01-19 02:30:25','2026-01-19 02:32:24',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:32:24'),(590,173,'2026-01-16',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:25','2026-01-19 02:30:25','2026-01-19 02:32:28',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:32:28'),(591,174,'2026-01-16',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:25','2026-01-19 02:30:25','2026-01-19 02:32:31',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:32:31'),(592,175,'2026-01-16',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:26','2026-01-19 02:30:26','2026-01-19 02:32:34',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:32:34'),(593,176,'2026-01-16',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:26','2026-01-19 02:30:26','2026-01-19 02:32:37',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:32:37'),(594,177,'2026-01-16',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:26','2026-01-19 02:30:26','2026-01-19 02:32:41',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:32:41'),(595,178,'2026-01-16',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:26','2026-01-19 02:30:26','2026-01-19 02:32:47',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:32:47'),(596,179,'2026-01-16',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:26','2026-01-19 02:30:26','2026-01-19 02:32:50',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:32:50'),(597,93,'2026-01-16',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:26','2026-01-19 02:30:26','2026-01-19 02:30:26',NULL,NULL,NULL,NULL,0,NULL,NULL),(598,170,'2026-01-17',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:43','2026-01-19 02:30:43','2026-01-19 02:31:36',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:31:36'),(599,171,'2026-01-17',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:43','2026-01-19 02:30:43','2026-01-19 02:31:39',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:31:39'),(600,172,'2026-01-17',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:43','2026-01-19 02:30:43','2026-01-19 02:31:42',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:31:42'),(601,173,'2026-01-17',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:43','2026-01-19 02:30:43','2026-01-19 02:31:46',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:31:46'),(602,174,'2026-01-17',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:43','2026-01-19 02:30:43','2026-01-19 02:31:51',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:31:51'),(603,175,'2026-01-17',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:43','2026-01-19 02:30:43','2026-01-19 02:31:55',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:31:55'),(604,176,'2026-01-17',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:43','2026-01-19 02:30:43','2026-01-19 02:31:58',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:31:58'),(605,177,'2026-01-17',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:43','2026-01-19 02:30:43','2026-01-19 02:32:01',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:32:01'),(606,178,'2026-01-17',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:43','2026-01-19 02:30:43','2026-01-19 02:32:06',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:32:06'),(607,179,'2026-01-17',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:43','2026-01-19 02:30:43','2026-01-19 02:32:09',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:32:09'),(608,93,'2026-01-17',7.58,0.00,0.00,'排班管理',1,'2026-01-19 02:30:43','2026-01-19 02:30:43','2026-01-19 02:32:12',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:32:12'),(609,170,'2026-01-18',0.00,0.00,0.00,'排班管理',1,'2026-01-19 02:34:35','2026-01-19 02:30:55','2026-01-19 02:34:39',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:34:39'),(610,171,'2026-01-18',0.00,0.00,0.00,'排班管理',1,'2026-01-19 02:34:35','2026-01-19 02:30:55','2026-01-19 02:34:41',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:34:41'),(611,172,'2026-01-18',0.00,0.00,0.00,'排班管理',1,'2026-01-19 02:34:35','2026-01-19 02:30:55','2026-01-19 02:34:43',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:34:43'),(612,173,'2026-01-18',0.00,0.00,0.00,'排班管理',1,'2026-01-19 02:34:35','2026-01-19 02:30:55','2026-01-19 02:34:45',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:34:45'),(613,174,'2026-01-18',0.00,0.00,0.00,'排班管理',1,'2026-01-19 02:34:35','2026-01-19 02:30:55','2026-01-19 02:34:47',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:34:47'),(614,175,'2026-01-18',0.00,0.00,0.00,'排班管理',1,'2026-01-19 02:34:35','2026-01-19 02:30:55','2026-01-19 02:34:49',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:34:49'),(615,176,'2026-01-18',0.00,0.00,0.00,'排班管理',1,'2026-01-19 02:34:35','2026-01-19 02:30:55','2026-01-19 02:34:51',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:34:51'),(616,177,'2026-01-18',0.00,0.00,0.00,'排班管理',1,'2026-01-19 02:34:36','2026-01-19 02:30:55','2026-01-19 02:34:54',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:34:54'),(617,178,'2026-01-18',0.00,0.00,0.00,'排班管理',1,'2026-01-19 02:34:36','2026-01-19 02:30:55','2026-01-19 02:34:57',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:34:57'),(618,179,'2026-01-18',0.00,0.00,0.00,'排班管理',1,'2026-01-19 02:34:36','2026-01-19 02:30:55','2026-01-19 02:34:59',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:34:59'),(619,93,'2026-01-18',0.00,0.00,0.00,'排班管理',1,'2026-01-19 02:34:36','2026-01-19 02:30:55','2026-01-19 02:35:02',NULL,NULL,NULL,NULL,1,92,'2026-01-19 02:35:02'),(620,170,'2026-01-19',7.58,0.00,0.00,'排班管理',1,'2026-01-20 06:57:38','2026-01-20 06:57:38','2026-01-20 06:57:41',NULL,NULL,NULL,NULL,1,92,'2026-01-20 06:57:41'),(621,171,'2026-01-19',7.58,0.00,0.00,'排班管理',1,'2026-01-20 06:57:38','2026-01-20 06:57:38','2026-01-20 06:57:44',NULL,NULL,NULL,NULL,1,92,'2026-01-20 06:57:44'),(622,172,'2026-01-19',7.58,0.00,0.00,'排班管理',1,'2026-01-20 06:57:38','2026-01-20 06:57:38','2026-01-20 06:57:46',NULL,NULL,NULL,NULL,1,92,'2026-01-20 06:57:46'),(623,173,'2026-01-19',7.58,0.00,0.00,'排班管理',1,'2026-01-20 06:57:38','2026-01-20 06:57:38','2026-01-20 07:00:33',NULL,NULL,NULL,NULL,1,92,'2026-01-20 07:00:33'),(624,174,'2026-01-19',7.58,0.00,0.00,'排班管理',1,'2026-01-20 06:57:38','2026-01-20 06:57:38','2026-01-20 07:00:36',NULL,NULL,NULL,NULL,1,92,'2026-01-20 07:00:36'),(625,175,'2026-01-19',7.58,0.00,0.00,'排班管理',1,'2026-01-20 06:57:38','2026-01-20 06:57:38','2026-01-20 07:00:39',NULL,NULL,NULL,NULL,1,92,'2026-01-20 07:00:39'),(626,176,'2026-01-19',7.58,0.00,0.00,'排班管理',1,'2026-01-20 06:57:38','2026-01-20 06:57:38','2026-01-20 07:00:41',NULL,NULL,NULL,NULL,1,92,'2026-01-20 07:00:41'),(627,177,'2026-01-19',7.58,0.00,0.00,'排班管理',1,'2026-01-20 06:57:38','2026-01-20 06:57:38','2026-01-20 07:00:44',NULL,NULL,NULL,NULL,1,92,'2026-01-20 07:00:44'),(628,178,'2026-01-19',7.58,0.00,0.00,'排班管理',1,'2026-01-20 06:57:38','2026-01-20 06:57:38','2026-01-20 07:00:46',NULL,NULL,NULL,NULL,1,92,'2026-01-20 07:00:46'),(629,179,'2026-01-19',7.58,0.00,0.00,'排班管理',1,'2026-01-20 06:57:38','2026-01-20 06:57:38','2026-01-20 07:00:48',NULL,NULL,NULL,NULL,1,92,'2026-01-20 07:00:48'),(630,93,'2026-01-19',7.58,0.00,0.00,'排班管理',1,'2026-01-20 06:57:38','2026-01-20 06:57:38','2026-01-20 07:00:51',NULL,NULL,NULL,NULL,1,92,'2026-01-20 07:00:51'),(631,170,'2026-01-20',7.58,0.00,0.00,'排班管理',1,'2026-01-20 07:01:34','2026-01-20 07:01:34','2026-01-20 07:01:37',NULL,NULL,NULL,NULL,1,92,'2026-01-20 07:01:37'),(632,171,'2026-01-20',7.58,0.00,0.00,'排班管理',1,'2026-01-20 07:01:35','2026-01-20 07:01:35','2026-01-20 07:01:39',NULL,NULL,NULL,NULL,1,92,'2026-01-20 07:01:39'),(633,172,'2026-01-20',7.58,0.00,0.00,'排班管理',1,'2026-01-20 07:01:35','2026-01-20 07:01:35','2026-01-20 07:01:41',NULL,NULL,NULL,NULL,1,92,'2026-01-20 07:01:41'),(634,173,'2026-01-20',7.58,0.00,0.00,'排班管理',1,'2026-01-20 07:01:35','2026-01-20 07:01:35','2026-01-20 07:01:43',NULL,NULL,NULL,NULL,1,92,'2026-01-20 07:01:43'),(635,174,'2026-01-20',7.58,0.00,0.00,'排班管理',1,'2026-01-20 07:01:35','2026-01-20 07:01:35','2026-01-20 07:01:46',NULL,NULL,NULL,NULL,1,92,'2026-01-20 07:01:46'),(636,175,'2026-01-20',7.58,0.00,0.00,'排班管理',1,'2026-01-20 07:01:35','2026-01-20 07:01:35','2026-01-20 07:01:48',NULL,NULL,NULL,NULL,1,92,'2026-01-20 07:01:48'),(637,176,'2026-01-20',7.58,0.00,0.00,'排班管理',1,'2026-01-20 07:01:35','2026-01-20 07:01:35','2026-01-20 07:01:51',NULL,NULL,NULL,NULL,1,92,'2026-01-20 07:01:51'),(638,177,'2026-01-20',7.58,0.00,0.00,'排班管理',1,'2026-01-20 07:01:35','2026-01-20 07:01:35','2026-01-20 07:01:55',NULL,NULL,NULL,NULL,1,92,'2026-01-20 07:01:55'),(639,178,'2026-01-20',7.58,0.00,0.00,'排班管理',1,'2026-01-20 07:01:35','2026-01-20 07:01:35','2026-01-20 07:02:18',NULL,NULL,NULL,NULL,1,92,'2026-01-20 07:02:18'),(640,179,'2026-01-20',7.58,0.00,0.00,'排班管理',1,'2026-01-20 07:01:35','2026-01-20 07:01:35','2026-01-20 07:02:21',NULL,NULL,NULL,NULL,1,92,'2026-01-20 07:02:21'),(641,93,'2026-01-20',7.58,0.00,0.00,'排班管理',1,'2026-01-20 07:01:35','2026-01-20 07:01:35','2026-01-20 07:02:24',NULL,NULL,NULL,NULL,1,92,'2026-01-20 07:02:24');
/*!40000 ALTER TABLE `daily_attendance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `efficiency_calculations`
--

DROP TABLE IF EXISTS `efficiency_calculations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `efficiency_calculations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `phase` varchar(50) NOT NULL,
  `assignee_id` int DEFAULT NULL COMMENT '阶段负责人ID',
  `assignee_name` varchar(100) DEFAULT NULL COMMENT '阶段负责人姓名',
  `standard_hours` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '标准工时',
  `actual_work_hours` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '实际出勤时间',
  `exception_hours` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '异常时间',
  `assist_hours` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '协助时间',
  `effective_hours` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '有效工时(实际工时-异常时间-协助时间)',
  `efficiency` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '效率百分比',
  `phase_start_time` datetime DEFAULT NULL COMMENT '阶段开始时间',
  `phase_end_time` datetime DEFAULT NULL COMMENT '阶段结束时间',
  `total_calendar_hours` decimal(10,2) DEFAULT NULL COMMENT '日历总时间',
  `is_confirmed` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已确认',
  `confirmed_by` int DEFAULT NULL COMMENT '确认人ID',
  `confirmed_at` timestamp NULL DEFAULT NULL COMMENT '确认时间',
  `calculation_date` date NOT NULL COMMENT '计算日期',
  `daily_calculations` json DEFAULT NULL COMMENT '单日计算详情(JSON格式)',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_task_phase_date` (`task_id`,`phase`,`calculation_date`),
  KEY `idx_task_id` (`task_id`),
  KEY `idx_phase` (`phase`),
  KEY `idx_assignee_id` (`assignee_id`),
  KEY `idx_calculation_date` (`calculation_date`),
  KEY `idx_is_confirmed` (`is_confirmed`),
  KEY `confirmed_by` (`confirmed_by`),
  CONSTRAINT `efficiency_calculations_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `efficiency_calculations_ibfk_2` FOREIGN KEY (`assignee_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `efficiency_calculations_ibfk_3` FOREIGN KEY (`confirmed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='效率计算结果表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `efficiency_calculations`
--

LOCK TABLES `efficiency_calculations` WRITE;
/*!40000 ALTER TABLE `efficiency_calculations` DISABLE KEYS */;
/*!40000 ALTER TABLE `efficiency_calculations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `exception_reports`
--

DROP TABLE IF EXISTS `exception_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `exception_reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `user_id` int NOT NULL,
  `exception_type` enum('缺料','来料不良','改造类（研发售后或生产不良）','临时安排任务') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `exception_time` datetime DEFAULT NULL COMMENT '异常发生时间',
  `exception_start_time` time DEFAULT NULL COMMENT '异常开始时间',
  `exception_end_time` time DEFAULT NULL COMMENT '异常结束时间',
  `exception_start_datetime` datetime DEFAULT NULL COMMENT '异常开始日期时间',
  `exception_end_datetime` datetime DEFAULT NULL COMMENT '异常结束日期时间',
  `impact_level` enum('低','中','高','紧急') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT '中',
  `status` enum('pending','pending_second_approval','pending_staff_confirmation','staff_confirmed','approved','rejected','processing','resolved') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'pending',
  `submitted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `approval_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `resolution_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `image_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '异常图片路径',
  `first_approver_id` int DEFAULT NULL COMMENT '一级审批人ID（主管）',
  `first_approved_at` datetime DEFAULT NULL COMMENT '一级审批时间',
  `first_approval_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci COMMENT '一级审批备注',
  `second_approver_id` int DEFAULT NULL COMMENT '二级审批人ID（经理）',
  `second_approved_at` datetime DEFAULT NULL COMMENT '二级审批时间',
  `second_approval_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci COMMENT '二级审批备注',
  `modified_exception_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '主管修改后的异常类型',
  `modified_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci COMMENT '主管修改后的异常描述',
  `modified_start_datetime` datetime DEFAULT NULL COMMENT '主管修改后的异常开始时间',
  `modified_end_datetime` datetime DEFAULT NULL COMMENT '主管修改后的异常结束时间',
  `assigned_to_staff_id` int DEFAULT NULL COMMENT '转给staff确认的用户ID',
  `staff_confirmed_at` datetime DEFAULT NULL COMMENT 'staff确认时间',
  `staff_confirmation_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci COMMENT 'staff确认备注',
  `phase` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '任务阶段：machining/electrical/pre_assembly/post_assembly/debugging 等',
  PRIMARY KEY (`id`),
  KEY `idx_task_user` (`task_id`,`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_exception_type` (`exception_type`),
  KEY `idx_submitted_at` (`submitted_at`),
  KEY `user_id` (`user_id`),
  KEY `approved_by` (`approved_by`),
  KEY `fk_first_approver` (`first_approver_id`),
  KEY `fk_second_approver` (`second_approver_id`),
  KEY `assigned_to_staff_id` (`assigned_to_staff_id`),
  CONSTRAINT `exception_reports_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `exception_reports_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `exception_reports_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `exception_reports_ibfk_4` FOREIGN KEY (`assigned_to_staff_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_first_approver` FOREIGN KEY (`first_approver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_second_approver` FOREIGN KEY (`second_approver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `exception_reports`
--

LOCK TABLES `exception_reports` WRITE;
/*!40000 ALTER TABLE `exception_reports` DISABLE KEYS */;
INSERT INTO `exception_reports` VALUES (22,622,175,'来料不良','来料不良','来料不良',NULL,NULL,NULL,'2026-01-16 15:30:00','2026-01-16 16:00:00','中','pending_staff_confirmation','2026-01-16 07:54:30',181,NULL,NULL,NULL,NULL,'2026-01-16 07:54:30','2026-01-19 06:05:11',NULL,181,'2026-01-19 14:02:45',NULL,86,'2026-01-19 14:05:11',NULL,NULL,NULL,NULL,NULL,90,NULL,NULL,NULL),(23,623,171,'缺料','缺料误工','缺料误工',NULL,NULL,NULL,'2026-01-16 15:30:00','2026-01-16 15:40:00','中','pending_staff_confirmation','2026-01-16 07:56:07',183,NULL,NULL,NULL,NULL,'2026-01-16 07:56:07','2026-01-19 06:05:15',NULL,183,'2026-01-19 14:03:47',NULL,86,'2026-01-19 14:05:15',NULL,'改造类（研发售后或生产不良）',NULL,NULL,NULL,91,NULL,NULL,NULL),(24,623,170,'临时安排任务','/','/',NULL,NULL,NULL,'2026-01-16 16:15:00','2026-01-16 16:30:00','中','approved','2026-01-16 08:42:17',181,NULL,NULL,NULL,NULL,'2026-01-16 08:42:17','2026-01-19 06:05:23',NULL,181,'2026-01-19 14:02:54',NULL,86,'2026-01-19 14:05:23',NULL,NULL,NULL,'2026-01-16 16:00:00',NULL,NULL,NULL,NULL,NULL),(25,626,175,'改造类（研发售后或生产不良）','测试','测试',NULL,NULL,NULL,'2026-01-19 08:30:00','2026-01-19 14:00:00','中','pending_staff_confirmation','2026-01-19 05:59:47',181,NULL,NULL,NULL,NULL,'2026-01-19 05:59:47','2026-01-19 06:05:19',NULL,181,'2026-01-19 14:03:03',NULL,86,'2026-01-19 14:05:19',NULL,NULL,NULL,'2026-01-19 09:00:00',NULL,91,NULL,NULL,NULL),(26,625,176,'来料不良','测试','测试',NULL,NULL,NULL,'2026-01-19 13:30:00','2026-01-19 14:00:00','中','pending_staff_confirmation','2026-01-19 06:00:36',183,NULL,NULL,NULL,NULL,'2026-01-19 06:00:36','2026-01-19 06:05:25',NULL,183,'2026-01-19 14:03:53',NULL,86,'2026-01-19 14:05:25',NULL,NULL,NULL,NULL,NULL,90,NULL,NULL,NULL),(27,622,177,'临时安排任务','测试','测试',NULL,NULL,NULL,'2026-01-19 13:30:00','2026-01-19 14:00:00','中','approved','2026-01-19 06:01:23',182,NULL,NULL,NULL,NULL,'2026-01-19 06:01:23','2026-01-19 06:05:28',NULL,182,'2026-01-19 14:04:36',NULL,86,'2026-01-19 14:05:28',NULL,NULL,NULL,'2026-01-19 11:00:00',NULL,NULL,NULL,NULL,NULL),(28,629,170,'来料不良','来料不良，耽误时间','来料不良，耽误时间',NULL,NULL,NULL,'2026-01-19 14:05:00','2026-01-19 14:58:00','中','pending','2026-01-19 07:08:34',181,NULL,NULL,NULL,NULL,'2026-01-19 07:08:34','2026-01-19 07:08:34',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(29,623,171,'缺料','缺料耽误时间','缺料耽误时间',NULL,NULL,NULL,'2026-01-19 10:00:00','2026-01-19 10:30:00','中','pending','2026-01-19 07:09:36',183,NULL,NULL,NULL,NULL,'2026-01-19 07:09:36','2026-01-19 07:09:36',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(30,624,174,'改造类（研发售后或生产不良）','调试不良，需要研发协助','调试不良，需要研发协助',NULL,NULL,NULL,'2026-01-19 14:00:00','2026-01-19 15:00:00','中','pending','2026-01-19 07:11:08',180,NULL,NULL,NULL,NULL,'2026-01-19 07:11:08','2026-01-19 07:11:08',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `exception_reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `holidays`
--

DROP TABLE IF EXISTS `holidays`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `holidays` (
  `id` int NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `type` enum('national','company') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'national',
  `is_working_day` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `date` (`date`)
) ENGINE=InnoDB AUTO_INCREMENT=9157 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `holidays`
--

LOCK TABLES `holidays` WRITE;
/*!40000 ALTER TABLE `holidays` DISABLE KEYS */;
INSERT INTO `holidays` VALUES (332,'2025-01-01','元旦','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(333,'2025-01-26','调休工作日','national',1,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(334,'2025-01-28','春节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(335,'2025-01-29','春节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(336,'2025-01-30','春节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(337,'2025-01-31','春节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(338,'2025-02-01','春节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(339,'2025-02-02','春节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(340,'2025-02-03','春节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(341,'2025-02-08','调休工作日','national',1,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(342,'2025-04-05','清明节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(343,'2025-04-06','清明节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(344,'2025-04-07','清明节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(345,'2025-04-27','调休工作日','national',1,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(346,'2025-05-01','劳动节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(347,'2025-05-02','劳动节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(348,'2025-05-03','劳动节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(349,'2025-05-04','劳动节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(350,'2025-05-05','劳动节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(351,'2025-06-14','端午节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(352,'2025-09-15','中秋节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(353,'2025-09-16','中秋节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(354,'2025-09-17','中秋节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(355,'2025-09-28','调休工作日','national',1,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(356,'2025-10-01','国庆节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(357,'2025-10-02','国庆节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(358,'2025-10-03','国庆节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(359,'2025-10-04','国庆节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(360,'2025-10-05','国庆节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(361,'2025-10-06','国庆节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(362,'2025-10-07','国庆节','national',0,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(363,'2025-10-12','调休工作日','national',1,'2025-10-21 03:40:16','2025-10-21 03:40:16'),(364,'2025-10-08','国庆节','national',0,'2025-10-21 03:41:14','2025-10-21 03:41:14'),(373,'2025-10-11','调休工作日','national',1,'2025-10-21 03:42:45','2025-10-21 03:42:45');
/*!40000 ALTER TABLE `holidays` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `task_time_logs`
--

DROP TABLE IF EXISTS `task_time_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `task_time_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `user_id` int NOT NULL,
  `start_time` datetime NOT NULL,
  `end_time` datetime DEFAULT NULL,
  `total_minutes` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_task_user` (`task_id`,`user_id`),
  KEY `idx_user_open` (`user_id`,`end_time`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `task_time_logs`
--

LOCK TABLES `task_time_logs` WRITE;
/*!40000 ALTER TABLE `task_time_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `task_time_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tasks`
--

DROP TABLE IF EXISTS `tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `status` enum('pending','completed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'pending',
  `priority` enum('normal','urgent') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'normal',
  `created_by` int DEFAULT NULL,
  `start_time` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  `estimated_hours` decimal(5,2) DEFAULT NULL,
  `actual_hours` decimal(5,2) DEFAULT NULL,
  `machining_hours_est` decimal(5,2) DEFAULT NULL,
  `electrical_hours_est` decimal(5,2) DEFAULT NULL,
  `pre_assembly_hours_est` decimal(5,2) DEFAULT NULL,
  `post_assembly_hours_est` decimal(5,2) DEFAULT NULL,
  `debugging_hours_est` decimal(5,2) DEFAULT NULL,
  `machining_phase` tinyint(1) DEFAULT '0',
  `electrical_phase` tinyint(1) DEFAULT '0',
  `pre_assembly_phase` tinyint(1) DEFAULT '0',
  `post_assembly_phase` tinyint(1) DEFAULT '0',
  `debugging_phase` tinyint(1) DEFAULT '0',
  `current_phase` enum('machining','electrical','pre_assembly','post_assembly','debugging') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'machining',
  `machining_start_time` datetime DEFAULT NULL,
  `electrical_start_time` datetime DEFAULT NULL,
  `pre_assembly_start_time` datetime DEFAULT NULL,
  `post_assembly_start_time` datetime DEFAULT NULL,
  `debugging_start_time` datetime DEFAULT NULL,
  `machining_complete_time` datetime DEFAULT NULL,
  `machining_paused_at` datetime DEFAULT NULL,
  `machining_pause_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `electrical_complete_time` datetime DEFAULT NULL,
  `electrical_paused_at` datetime DEFAULT NULL,
  `electrical_pause_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `pre_assembly_complete_time` datetime DEFAULT NULL,
  `pre_assembly_paused_at` datetime DEFAULT NULL,
  `pre_assembly_pause_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `post_assembly_complete_time` datetime DEFAULT NULL,
  `post_assembly_paused_at` datetime DEFAULT NULL,
  `post_assembly_pause_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `debugging_complete_time` datetime DEFAULT NULL,
  `debugging_paused_at` datetime DEFAULT NULL,
  `debugging_pause_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `device_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `product_model` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `order_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `production_time` datetime DEFAULT NULL,
  `promised_completion_time` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `machining_assignee` int DEFAULT NULL,
  `electrical_assignee` int DEFAULT NULL,
  `pre_assembly_assignee` int DEFAULT NULL,
  `post_assembly_assignee` int DEFAULT NULL,
  `debugging_assignee` int DEFAULT NULL,
  `machining_order` int DEFAULT NULL COMMENT '机加阶段紧急顺序，数字越小越紧急',
  `electrical_order` int DEFAULT NULL COMMENT '电控阶段紧急顺序，数字越小越紧急',
  `pre_assembly_order` int DEFAULT NULL COMMENT '预装阶段紧急顺序，数字越小越紧急',
  `post_assembly_order` int DEFAULT NULL COMMENT '总装阶段紧急顺序，数字越小越紧急',
  `debugging_order` int DEFAULT NULL COMMENT '调试阶段紧急顺序，数字越小越紧急',
  `is_non_standard` tinyint(1) DEFAULT '0' COMMENT '是否非标：0=否，1=是',
  PRIMARY KEY (`id`),
  KEY `fk_tasks_created_by` (`created_by`),
  KEY `idx_tasks_device_number` (`device_number`),
  KEY `idx_tasks_product_model` (`product_model`),
  KEY `idx_tasks_order_status` (`order_status`),
  KEY `idx_tasks_production_time` (`production_time`),
  KEY `fk_machining_assignee` (`machining_assignee`),
  KEY `fk_electrical_assignee` (`electrical_assignee`),
  KEY `fk_tasks_pre_assembly_assignee` (`pre_assembly_assignee`),
  KEY `fk_tasks_post_assembly_assignee` (`post_assembly_assignee`),
  KEY `fk_tasks_debugging_assignee` (`debugging_assignee`),
  CONSTRAINT `fk_electrical_assignee` FOREIGN KEY (`electrical_assignee`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_machining_assignee` FOREIGN KEY (`machining_assignee`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_tasks_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_tasks_debugging_assignee` FOREIGN KEY (`debugging_assignee`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tasks_post_assembly_assignee` FOREIGN KEY (`post_assembly_assignee`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tasks_pre_assembly_assignee` FOREIGN KEY (`pre_assembly_assignee`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=637 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tasks`
--

LOCK TABLES `tasks` WRITE;
/*!40000 ALTER TABLE `tasks` DISABLE KEYS */;
INSERT INTO `tasks` VALUES (621,'T1 - Icon','设备号：T1，产品型号：Icon，订单状态：未开工','completed','normal',92,NULL,'2026-01-19 15:08:45',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,1,1,1,1,'electrical','2026-01-16 14:30:41','2026-01-19 09:57:38','2026-01-16 15:55:14','2026-01-16 16:43:06','2026-01-16 17:55:28','2026-01-16 15:46:04',NULL,NULL,'2026-01-19 15:08:45',NULL,NULL,'2026-01-16 16:42:50',NULL,NULL,'2026-01-16 17:55:15',NULL,NULL,'2026-01-19 09:50:02',NULL,NULL,'T1','Icon','未开工','2025-11-20 00:00:00',NULL,'2026-01-16 05:48:16','2026-01-19 07:08:45',170,171,172,173,174,0,1,0,0,0,1),(622,'T2 - Cube','设备号：T2，产品型号：VC5300CP，订单状态：未开工','completed','normal',92,NULL,'2026-01-19 16:54:43',NULL,NULL,11.00,5.00,13.80,13.40,7.00,1,1,1,1,1,'debugging','2026-01-16 14:53:43','2026-01-16 15:55:01','2026-01-19 10:19:19','2026-01-19 14:01:49','2026-01-19 15:04:50','2026-01-16 15:54:47',NULL,NULL,'2026-01-19 10:19:03',NULL,NULL,'2026-01-19 14:01:32',NULL,NULL,'2026-01-19 15:04:33',NULL,NULL,'2026-01-19 16:54:43',NULL,NULL,'T2','Cube','未开工','2025-11-19 00:00:00',NULL,'2026-01-16 05:48:17','2026-01-21 05:41:51',175,176,177,178,179,0,1,0,0,0,0),(623,'T3 - Cube','设备号：T3，产品型号：V5300DP，订单状态：未开工','completed','normal',92,NULL,'2026-01-19 11:12:14',NULL,NULL,11.00,5.00,13.80,13.40,7.00,1,1,1,1,1,'debugging','2026-01-16 14:43:11','2026-01-16 14:32:02','2026-01-16 16:42:50','2026-01-16 17:55:15','2026-01-19 09:50:02','2026-01-16 16:42:25',NULL,NULL,'2026-01-16 15:47:55',NULL,NULL,'2026-01-16 17:55:01',NULL,NULL,'2026-01-19 09:49:41',NULL,NULL,'2026-01-19 11:12:14',NULL,NULL,'T3','Cube','未开工','2025-10-29 00:00:00',NULL,'2026-01-16 05:48:17','2026-01-21 05:53:33',170,171,172,173,174,1,1,1,1,1,0),(624,'T4 - Cube','设备号：T4，产品型号：Cube，订单状态：未开工','completed','normal',92,NULL,'2026-01-19 15:10:20',NULL,NULL,11.00,5.00,13.80,13.40,7.00,1,1,1,1,1,'debugging','2026-01-16 16:42:25','2026-01-16 15:30:20','2026-01-16 17:55:01','2026-01-19 09:49:42','2026-01-19 11:12:14','2026-01-16 17:54:01',NULL,NULL,'2026-01-16 16:39:57',NULL,NULL,'2026-01-19 09:49:32',NULL,NULL,'2026-01-19 11:12:02',NULL,NULL,'2026-01-19 15:10:20',NULL,NULL,'T4','Cube','未开工','2025-11-20 00:00:00',NULL,'2026-01-16 05:48:17','2026-01-21 05:53:14',170,171,172,173,174,2,2,2,2,2,0),(625,'T5 - Icon','设备号：T5，产品型号：Icon，订单状态：未开工','completed','normal',92,NULL,'2026-01-19 16:54:14',NULL,NULL,9.30,5.00,9.00,12.90,5.50,1,1,1,1,1,'debugging','2026-01-16 15:54:47','2026-01-19 10:19:03','2026-01-19 14:01:32','2026-01-19 15:04:33','2026-01-19 15:58:58','2026-01-19 10:18:41',NULL,NULL,'2026-01-19 14:00:44',NULL,NULL,'2026-01-19 15:04:21',NULL,NULL,'2026-01-19 16:54:14',NULL,NULL,'2026-01-19 15:59:20',NULL,NULL,'T5','Icon','未开工','2025-11-20 00:00:00',NULL,'2026-01-16 05:48:17','2026-01-21 05:53:33',175,176,177,178,179,1,3,1,0,1,0),(626,'T6 - Cube','设备号：T6，产品型号：V5100BP，订单状态：未开工','completed','normal',92,NULL,'2026-01-20 14:56:50',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,1,1,1,1,'debugging','2026-01-19 10:18:41','2026-01-19 14:00:45','2026-01-19 15:04:21','2026-01-20 10:01:34','2026-01-20 13:25:13','2026-01-19 14:00:00',NULL,NULL,'2026-01-19 15:04:06',NULL,NULL,'2026-01-19 16:53:37',NULL,NULL,'2026-01-20 10:30:38',NULL,NULL,'2026-01-20 14:56:50',NULL,NULL,'T6','V5100BP','未开工','2025-11-20 00:00:00',NULL,'2026-01-16 05:48:17','2026-01-21 05:53:14',175,176,177,178,179,2,4,2,2,3,0),(627,'T7 - A1000D','设备号：T7，产品型号：A10，订单状态：未开工','completed','normal',92,NULL,'2026-01-19 18:14:51',NULL,NULL,5.00,2.70,0.00,9.00,2.40,1,1,1,1,1,'debugging','2026-01-16 17:54:01','2026-01-16 16:39:57','2026-01-19 09:49:32','2026-01-19 11:12:02','2026-01-19 15:10:21','2026-01-19 09:47:26',NULL,NULL,'2026-01-16 17:54:34',NULL,NULL,'2026-01-19 11:11:47',NULL,NULL,'2026-01-19 15:10:02',NULL,NULL,'2026-01-19 18:14:51',NULL,NULL,'T7','A10','未开工','2025-11-18 00:00:00',NULL,'2026-01-16 05:48:17','2026-01-21 05:53:33',170,171,172,173,174,3,3,3,3,2,0),(628,'T8 - A1000D','设备号：T8，产品型号：A10，订单状态：未开工','completed','normal',92,NULL,'2026-01-20 10:31:42',NULL,NULL,5.00,2.70,0.00,9.00,2.40,1,1,1,1,1,'debugging','2026-01-19 14:00:00','2026-01-19 15:04:06','2026-01-19 16:53:37','2026-01-20 10:01:05','2026-01-20 10:01:55','2026-01-19 15:03:49',NULL,NULL,'2026-01-19 16:53:23',NULL,NULL,'2026-01-20 10:01:05',NULL,NULL,'2026-01-20 10:31:08',NULL,NULL,'2026-01-20 10:31:42',NULL,NULL,'T8','A10','未开工','2025-11-18 00:00:00',NULL,'2026-01-16 05:48:17','2026-01-21 05:53:14',175,176,177,177,179,3,5,3,4,1,0),(629,'T9 - Cube','设备号：T9，产品型号：A5200A，订单状态：未开工','completed','normal',92,NULL,'2026-01-20 10:39:56',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,1,1,1,1,'debugging','2026-01-16 17:54:09','2026-01-16 17:54:34','2026-01-19 15:58:22','2026-01-19 18:14:43','2026-01-19 18:14:52','2026-01-19 15:51:28',NULL,NULL,'2026-01-19 09:57:38',NULL,NULL,'2026-01-19 18:14:36',NULL,NULL,'2026-01-20 10:39:46',NULL,NULL,'2026-01-20 10:39:56',NULL,NULL,'T9','A5200A','未开工','2025-11-18 00:00:00',NULL,'2026-01-16 05:48:17','2026-01-21 05:53:14',170,171,172,173,174,4,0,4,4,3,0),(630,'T10 - Cube','设备号：T10，产品型号：VC5100DP，订单状态：未开工','completed','normal',92,NULL,'2026-01-20 13:25:13',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,1,1,1,1,'debugging','2026-01-19 15:03:49','2026-01-19 16:53:23','2026-01-20 10:31:09','2026-01-20 10:31:18','2026-01-20 10:31:42','2026-01-19 15:55:47',NULL,NULL,'2026-01-20 10:00:57',NULL,NULL,'2026-01-20 13:24:41',NULL,NULL,'2026-01-20 13:25:00',NULL,NULL,'2026-01-20 13:25:13',NULL,NULL,'T10','VC5100DP','未开工','2025-11-07 00:00:00',NULL,'2026-01-16 05:48:17','2026-01-21 05:53:14',175,176,177,178,179,4,6,5,1,2,0),(636,'T11 - Cube','设备号：T11，产品型号：Cube，订单状态：未开工','pending','normal',92,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,0,'machining',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'T11','Cube','未开工','2025-11-20 00:00:00',NULL,'2026-01-21 06:20:37','2026-01-21 06:20:37',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0);
/*!40000 ALTER TABLE `tasks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `role` enum('worker','supervisor','admin','manager','staff') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'worker',
  `department` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_group` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=208 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','admin123','系统管理员','admin','IT部门','2025-10-13 05:42:06','2025-10-13 05:42:06',NULL),(86,'pikaiqing','123456','皮凯青','manager','生产部','2025-10-27 07:07:28','2026-01-06 06:26:10',NULL),(88,'qiuzesong','123456','丘泽松','staff','工程部','2025-12-12 03:02:18','2025-12-12 03:02:18',NULL),(89,'zenghua','123456','曾华','staff','PMC','2025-12-12 03:06:02','2025-12-12 03:06:02',NULL),(90,'zhouquan','123456','周泉','staff','质量部','2025-12-12 03:06:36','2025-12-12 03:06:36',NULL),(91,'yuanwei','123456','袁伟','staff','售后','2025-12-12 03:08:23','2025-12-12 03:08:23',NULL),(92,'admin123','123456','管理员账号1','admin','IT部门','2025-12-12 03:08:23','2025-12-12 03:08:23',NULL),(93,'worker1','123456','试用账号','worker','生产部','2025-12-12 03:08:23','2025-12-12 03:08:23',NULL),(170,'test01','123456','test01','worker','机加','2026-01-16 06:13:44','2026-01-16 06:13:44','郭东林'),(171,'test02','123456','test02','worker','电控','2026-01-16 06:13:44','2026-01-16 06:13:44','张北源'),(172,'test03','123456','test03','worker','总装前段','2026-01-16 06:13:44','2026-01-16 06:13:44','李连杰'),(173,'test04','123456','test04','worker','总装后段','2026-01-16 06:13:45','2026-01-16 06:13:45','温碧峄'),(174,'test05','123456','test05','worker','调试','2026-01-16 06:13:45','2026-01-16 06:13:45','温碧峄'),(175,'test06','123456','test06','worker','机加','2026-01-16 06:13:45','2026-01-16 06:13:45','郭东林'),(176,'test07','123456','test07','worker','电控','2026-01-16 06:13:45','2026-01-16 06:13:45','张北源'),(177,'test08','123456','test08','worker','总装前段','2026-01-16 06:13:45','2026-01-16 06:13:45','李连杰'),(178,'test09','123456','test09','worker','总装后段','2026-01-16 06:13:45','2026-01-16 06:13:45','温碧峄'),(179,'test10','123456','test10','worker','调试','2026-01-16 06:13:45','2026-01-16 06:13:45','温碧峄'),(180,'wenbiyi','123456','温碧峄','supervisor','生产部','2026-01-16 07:53:47','2026-01-16 07:53:47','温碧峄'),(181,'guodonglin','123456','郭东林','supervisor','生产部','2026-01-16 07:53:47','2026-01-16 07:53:47','郭东林'),(182,'lilianjie','123456','李连杰','supervisor','生产部','2026-01-16 07:53:47','2026-01-16 07:53:47','李连杰'),(183,'zhangbeiyuan','123456','张北源','supervisor','生产部','2026-01-16 07:53:47','2026-01-16 07:53:47','张北源'),(184,'pengwenbao','123456','彭文豹','worker','调试','2026-01-21 07:18:57','2026-01-21 07:18:57','温碧峄'),(185,'pengxiaotao','123456','彭小涛','worker','调试','2026-01-21 07:18:57','2026-01-21 07:18:57','温碧峄'),(186,'hejintao','123456','何金涛','worker','机加','2026-01-21 07:18:57','2026-01-21 07:18:57','李连杰'),(187,'jiangrenxuan','123456','姜仁宣','worker','机加','2026-01-21 07:18:57','2026-01-21 07:18:57','郭东林'),(188,'liangweiyi','123456','梁伟宜','worker','机加','2026-01-21 07:18:57','2026-01-21 07:18:57','郭东林'),(189,'luqiang','123456','陆强','worker','机加','2026-01-21 07:18:58','2026-01-21 07:18:58','郭东林'),(190,'luojin','123456','骆金','worker','机加','2026-01-21 07:18:58','2026-01-21 07:18:58','李连杰'),(191,'zhangquan','123456','张权','worker','机加','2026-01-21 07:18:58','2026-01-21 07:18:58','李连杰'),(192,'zhoutaoxia','123456','周桃侠','worker','机加','2026-01-21 07:18:58','2026-01-21 07:18:58','郭东林'),(193,'chenjianchuang','123456','陈建创','worker','总装后段','2026-01-21 07:18:58','2026-01-21 07:18:58','郭东林'),(194,'lanzhicong','123456','蓝志聪','worker','总装后段','2026-01-21 07:18:58','2026-01-21 07:18:58','郭东林'),(195,'liuqiang','123456','刘强','worker','总装后段','2026-01-21 07:18:58','2026-01-21 07:18:58','李连杰'),(196,'tanyulin','123456','谭宇林','worker','总装后段','2026-01-21 07:18:58','2026-01-21 07:18:58','郭东林'),(197,'wangaiming','123456','王爱明','worker','总装后段','2026-01-21 07:18:58','2026-01-21 07:18:58','郭东林'),(198,'yuyue','123456','余跃','worker','总装后段','2026-01-21 07:18:58','2026-01-21 07:18:58','李连杰'),(199,'dengjiaen','123456','邓嘉恩','worker','总装前段','2026-01-21 07:18:58','2026-01-21 07:18:58','郭东林'),(200,'dengyuqi','123456','邓裕琪','worker','总装前段','2026-01-21 07:18:58','2026-01-21 07:18:58','李连杰'),(201,'huzhuoyi','123456','胡卓毅','worker','总装前段','2026-01-21 07:18:58','2026-01-21 07:18:58','郭东林'),(202,'tanxiaobo','123456','谭孝波','worker','总装前段','2026-01-21 07:18:58','2026-01-21 07:18:58','李连杰'),(203,'wangshengquan','123456','王胜权','worker','总装前段','2026-01-21 07:18:58','2026-01-21 07:18:58','郭东林'),(204,'zhouyuansheng','123456','周远胜','worker','总装前段','2026-01-21 07:18:59','2026-01-21 07:18:59','李连杰'),(205,'zouqiaomu','123456','邹乔木','worker','总装前段','2026-01-21 07:18:59','2026-01-21 07:18:59','李连杰'),(206,'cuixiuying','123456','崔秀应','worker','机加','2026-01-21 07:18:59','2026-01-21 07:18:59','李连杰'),(207,'huliushun','123456','胡柳顺','worker','机加','2026-01-21 07:18:59','2026-01-21 07:18:59','李连杰');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `work_reports`
--

DROP TABLE IF EXISTS `work_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `work_reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `user_id` int NOT NULL,
  `work_type` enum('start','pause','resume','complete','quality_check','assist') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `assist_phase` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `assist_start` datetime DEFAULT NULL,
  `assist_end` datetime DEFAULT NULL,
  `start_time` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  `hours_worked` decimal(5,2) DEFAULT NULL,
  `quantity_completed` int DEFAULT '0',
  `quality_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `issues` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approval_status` enum('pending','approved','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'pending',
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_work_reports_user_id` (`user_id`),
  KEY `fk_work_reports_task_id` (`task_id`),
  CONSTRAINT `fk_work_reports_task_id` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_work_reports_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=106 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `work_reports`
--

LOCK TABLES `work_reports` WRITE;
/*!40000 ALTER TABLE `work_reports` DISABLE KEYS */;
INSERT INTO `work_reports` VALUES (55,621,170,'complete',NULL,NULL,NULL,'2026-01-16 14:30:41','2026-01-16 15:46:04',0.00,1,'','','2026-01-16 07:46:04','approved',NULL,NULL),(56,623,171,'complete',NULL,NULL,NULL,'2026-01-16 14:32:02','2026-01-16 15:47:55',0.00,1,'','','2026-01-16 07:47:55','approved',NULL,NULL),(57,622,175,'complete',NULL,NULL,NULL,'2026-01-16 14:53:43','2026-01-16 15:54:47',0.00,1,'','','2026-01-16 07:54:47','approved',NULL,NULL),(58,624,171,'complete',NULL,NULL,NULL,'2026-01-16 15:30:20','2026-01-16 16:39:58',0.00,1,'','','2026-01-16 08:39:57','approved',NULL,NULL),(59,623,170,'complete',NULL,NULL,NULL,'2026-01-16 14:43:11','2026-01-16 16:42:25',0.00,1,'','','2026-01-16 08:42:25','approved',NULL,NULL),(60,621,172,'complete',NULL,NULL,NULL,'2026-01-16 15:55:14','2026-01-16 16:42:51',0.00,1,'','','2026-01-16 08:42:50','approved',NULL,NULL),(61,624,170,'complete',NULL,NULL,NULL,'2026-01-16 16:42:25','2026-01-16 17:54:02',0.00,1,'','','2026-01-16 09:54:01','approved',NULL,NULL),(62,627,171,'complete',NULL,NULL,NULL,'2026-01-16 16:39:57','2026-01-16 17:54:34',0.00,1,'','','2026-01-16 09:54:34','approved',NULL,NULL),(63,623,172,'complete',NULL,NULL,NULL,'2026-01-16 16:42:50','2026-01-16 17:55:02',0.00,1,'','','2026-01-16 09:55:01','approved',NULL,NULL),(64,621,173,'complete',NULL,NULL,NULL,'2026-01-16 16:43:06','2026-01-16 17:55:15',0.00,1,'','','2026-01-16 09:55:15','approved',NULL,NULL),(65,627,170,'complete',NULL,NULL,NULL,'2026-01-16 17:54:01','2026-01-19 09:47:26',0.00,1,'','','2026-01-19 01:47:26','approved',NULL,NULL),(66,624,172,'complete',NULL,NULL,NULL,'2026-01-16 17:55:01','2026-01-19 09:49:33',0.00,1,'','','2026-01-19 01:49:32','approved',NULL,NULL),(67,623,173,'complete',NULL,NULL,NULL,'2026-01-16 17:55:15','2026-01-19 09:49:42',0.00,1,'','','2026-01-19 01:49:41','approved',NULL,NULL),(68,621,174,'complete',NULL,NULL,NULL,'2026-01-16 17:55:28','2026-01-19 09:50:02',0.00,1,'','','2026-01-19 01:50:02','approved',NULL,NULL),(69,629,171,'complete',NULL,NULL,NULL,'2026-01-16 17:54:34','2026-01-19 09:57:39',0.00,1,'','','2026-01-19 01:57:38','approved',NULL,NULL),(70,625,175,'complete',NULL,NULL,NULL,'2026-01-16 15:54:47','2026-01-19 10:18:41',0.00,1,'','','2026-01-19 02:18:41','approved',NULL,NULL),(71,622,176,'complete',NULL,NULL,NULL,'2026-01-16 15:55:01','2026-01-19 10:19:04',0.00,1,'','','2026-01-19 02:19:03','approved',NULL,NULL),(72,627,172,'complete',NULL,NULL,NULL,'2026-01-19 09:49:32','2026-01-19 11:11:47',0.00,1,'','','2026-01-19 03:11:47','approved',NULL,NULL),(73,624,173,'complete',NULL,NULL,NULL,'2026-01-19 09:49:42','2026-01-19 11:12:02',0.00,1,'','','2026-01-19 03:12:02','approved',NULL,NULL),(74,623,174,'complete',NULL,NULL,NULL,'2026-01-19 09:50:02','2026-01-19 11:12:14',0.00,1,'','','2026-01-19 03:12:14','approved',NULL,NULL),(75,626,175,'complete',NULL,NULL,NULL,'2026-01-19 10:18:41','2026-01-19 14:00:00',0.00,1,'','','2026-01-19 06:00:00','approved',NULL,NULL),(76,625,176,'complete',NULL,NULL,NULL,'2026-01-19 10:19:03','2026-01-19 14:00:45',0.00,1,'','','2026-01-19 06:00:44','approved',NULL,NULL),(77,622,177,'complete',NULL,NULL,NULL,'2026-01-19 10:19:19','2026-01-19 14:01:32',0.00,1,'','','2026-01-19 06:01:32','approved',NULL,NULL),(78,628,175,'complete',NULL,NULL,NULL,'2026-01-19 14:00:00','2026-01-19 15:03:49',0.00,1,'','','2026-01-19 07:03:49','approved',NULL,NULL),(79,626,176,'complete',NULL,NULL,NULL,'2026-01-19 14:00:45','2026-01-19 15:04:07',0.00,1,'','','2026-01-19 07:04:06','approved',NULL,NULL),(80,625,177,'complete',NULL,NULL,NULL,'2026-01-19 14:01:32','2026-01-19 15:04:22',0.00,1,'','','2026-01-19 07:04:21','approved',NULL,NULL),(81,622,178,'complete',NULL,NULL,NULL,'2026-01-19 14:01:49','2026-01-19 15:04:33',0.00,1,'','','2026-01-19 07:04:33','approved',NULL,NULL),(82,621,171,'complete',NULL,NULL,NULL,'2026-01-19 09:57:38','2026-01-19 15:08:46',0.00,1,'','','2026-01-19 07:08:45','approved',NULL,NULL),(83,627,173,'complete',NULL,NULL,NULL,'2026-01-19 11:12:02','2026-01-19 15:10:03',0.00,1,'','','2026-01-19 07:10:02','approved',NULL,NULL),(84,624,174,'complete',NULL,NULL,NULL,'2026-01-19 11:12:14','2026-01-19 15:10:21',0.00,1,'','','2026-01-19 07:10:20','approved',NULL,NULL),(85,622,170,'assist','machining','2026-01-19 15:10:00','2026-01-19 15:40:00',NULL,NULL,NULL,0,'主管指定协助完成紧急任务',NULL,'2026-01-19 07:41:00','approved',86,'2026-01-19 15:41:21'),(86,629,170,'complete',NULL,NULL,NULL,'2026-01-16 17:54:09','2026-01-19 15:51:28',15.16,1,'','','2026-01-19 07:51:28','approved',NULL,NULL),(87,630,175,'complete',NULL,NULL,NULL,'2026-01-19 15:03:49','2026-01-19 15:55:48',0.00,1,'','','2026-01-19 07:55:47','approved',NULL,NULL),(88,625,179,'complete',NULL,NULL,NULL,'2026-01-19 15:58:58','2026-01-19 15:59:20',0.00,1,'','','2026-01-19 07:59:20','approved',NULL,NULL),(89,628,176,'complete',NULL,NULL,NULL,'2026-01-19 15:04:06','2026-01-19 16:53:24',0.00,1,'','','2026-01-19 08:53:23','approved',NULL,NULL),(90,626,177,'complete',NULL,NULL,NULL,'2026-01-19 15:04:21','2026-01-19 16:53:38',0.00,1,'','','2026-01-19 08:53:37','approved',NULL,NULL),(91,625,178,'complete',NULL,NULL,NULL,'2026-01-19 15:04:33','2026-01-19 16:54:15',0.00,1,'','','2026-01-19 08:54:14','approved',NULL,NULL),(92,622,179,'complete',NULL,NULL,NULL,'2026-01-19 15:04:50','2026-01-19 16:54:43',0.00,1,'','','2026-01-19 08:54:43','approved',NULL,NULL),(93,629,172,'complete',NULL,NULL,NULL,'2026-01-19 15:58:22','2026-01-19 18:14:36',0.00,1,'','','2026-01-19 10:14:36','approved',NULL,NULL),(94,627,174,'complete',NULL,NULL,NULL,'2026-01-19 15:10:21','2026-01-19 18:14:52',0.00,1,'','','2026-01-19 10:14:51','approved',NULL,NULL),(95,630,176,'complete',NULL,NULL,NULL,'2026-01-19 16:53:23','2026-01-20 10:00:57',0.00,1,'','','2026-01-20 02:00:57','approved',NULL,NULL),(96,628,177,'complete',NULL,NULL,NULL,'2026-01-19 16:53:37','2026-01-20 10:01:06',0.00,1,'','','2026-01-20 02:01:05','approved',NULL,NULL),(97,626,178,'complete',NULL,NULL,NULL,'2026-01-20 10:01:34','2026-01-20 10:30:39',0.00,1,'','','2026-01-20 02:30:38','approved',NULL,NULL),(98,628,177,'complete',NULL,NULL,NULL,'2026-01-20 10:01:05','2026-01-20 10:31:09',0.00,1,'','','2026-01-20 02:31:08','approved',NULL,NULL),(99,628,179,'complete',NULL,NULL,NULL,'2026-01-20 10:01:55','2026-01-20 10:31:42',0.00,1,'','','2026-01-20 02:31:42','approved',NULL,NULL),(100,629,173,'complete',NULL,NULL,NULL,'2026-01-19 18:14:43','2026-01-20 10:39:47',0.00,1,'','','2026-01-20 02:39:46','approved',NULL,NULL),(101,629,174,'complete',NULL,NULL,NULL,'2026-01-19 18:14:52','2026-01-20 10:39:56',0.00,1,'','','2026-01-20 02:39:56','approved',NULL,NULL),(102,630,177,'complete',NULL,NULL,NULL,'2026-01-20 10:31:09','2026-01-20 13:24:42',0.00,1,'','','2026-01-20 05:24:41','approved',NULL,NULL),(103,630,178,'complete',NULL,NULL,NULL,'2026-01-20 10:31:18','2026-01-20 13:25:01',0.00,1,'','','2026-01-20 05:25:00','approved',NULL,NULL),(104,630,179,'complete',NULL,NULL,NULL,'2026-01-20 10:31:42','2026-01-20 13:25:14',0.00,1,'','','2026-01-20 05:25:13','approved',NULL,NULL),(105,626,179,'complete',NULL,NULL,NULL,'2026-01-20 13:25:13','2026-01-20 14:56:50',0.00,1,'','','2026-01-20 06:56:50','approved',NULL,NULL);
/*!40000 ALTER TABLE `work_reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `work_time_settings`
--

DROP TABLE IF EXISTS `work_time_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `work_time_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `start_time` varchar(5) COLLATE utf8mb4_general_ci NOT NULL,
  `end_time` varchar(5) COLLATE utf8mb4_general_ci NOT NULL,
  `lunch_start_time` varchar(5) COLLATE utf8mb4_general_ci NOT NULL,
  `lunch_end_time` varchar(5) COLLATE utf8mb4_general_ci NOT NULL,
  `other_break_start_time` varchar(5) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `other_break_end_time` varchar(5) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `standard_hours` decimal(5,2) NOT NULL DEFAULT '7.58',
  `default_overtime_start_time` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `default_overtime_end_time` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `updated_by` int DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `work_time_settings_ibfk_1` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `work_time_settings`
--

LOCK TABLES `work_time_settings` WRITE;
/*!40000 ALTER TABLE `work_time_settings` DISABLE KEYS */;
INSERT INTO `work_time_settings` VALUES (18,'08:30','17:50','11:50','13:20','16:00','16:15',7.58,NULL,NULL,'',1,'2025-10-23 02:39:37'),(19,'08:30','17:50','11:50','13:20','16:00','16:15',7.58,NULL,NULL,'',1,'2025-11-05 09:09:26'),(20,'08:30','17:50','11:50','13:20','16:00','16:15',7.58,NULL,NULL,'',1,'2025-12-11 06:15:36'),(21,'08:30','17:50','11:50','13:20','16:00','16:15',7.58,NULL,NULL,'',1,'2025-12-11 06:25:16'),(22,'08:30','17:50','11:50','13:20','16:00','16:15',7.58,'18:20',NULL,'',1,'2025-12-11 06:27:59'),(23,'08:30','17:50','11:50','13:20','16:00','16:15',7.58,'18:20',NULL,'',1,'2025-12-11 06:36:11'),(24,'08:30','17:50','11:50','13:20','16:00','16:15',7.58,'18:20',NULL,'',1,'2025-12-11 06:37:20'),(25,'08:30','17:50','11:50','13:20','16:00','16:15',7.58,'18:20',NULL,'',1,'2025-12-11 06:43:24'),(26,'08:30','17:50','11:50','13:20','16:00','16:20',7.50,'18:20',NULL,'',1,'2025-12-11 06:47:18'),(27,'08:30','17:50','11:50','13:20','16:00','16:20',7.50,'18:20','20:20','',1,'2025-12-11 08:31:31'),(28,'08:30','17:50','11:50','13:20','16:00','16:15',7.58,'18:20','20:20','',1,'2025-12-11 10:20:03'),(29,'08:30','17:50','11:50','13:20','16:00','16:15',7.58,'18:20','20:20','',1,'2025-12-24 02:27:36');
/*!40000 ALTER TABLE `work_time_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'workshop_db'
--

--
-- Dumping routines for database 'workshop_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-21 15:20:04
